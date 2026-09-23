import type { Attachment } from '@echo/shared';
import { echoWebSocketService } from './websocket';
import { iceServersService } from './iceServers';

const CHUNK_SIZE = 16384; // 16KB WebRTC DataChannel chunk
const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1MB backpressure threshold

export interface P2PTransferProgress {
  offerId: string;
  status: 'idle' | 'connecting' | 'transferring' | 'completed' | 'error';
  progress: number; // 0 - 100
  bytesTransferred: number;
  totalBytes: number;
  error?: string;
}

type ProgressListener = (progress: P2PTransferProgress) => void;

class P2PFileTransferService {
  private localFiles: Map<string, File> = new Map(); // fileHash -> File
  private activePeerConnections: Map<string, RTCPeerConnection> = new Map();
  private progressListeners: Set<ProgressListener> = new Set();
  private transferStates: Map<string, P2PTransferProgress> = new Map();

  subscribe(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  getProgress(offerId: string): P2PTransferProgress | undefined {
    return this.transferStates.get(offerId);
  }

  private updateProgress(state: P2PTransferProgress): void {
    this.transferStates.set(state.offerId, state);
    for (const listener of this.progressListeners) {
      listener(state);
    }
  }

  async registerFileForSharing(file: File): Promise<Attachment> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    this.localFiles.set(fileHash, file);

    const attachmentId = crypto.randomUUID();
    const attachment: Attachment = {
      id: attachmentId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      url: '',
      type: 'file',
      p2pOffer: {
        fileHash,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      },
    };

    return attachment;
  }

  async startDownload(
    targetUserId: string,
    offerId: string,
    fileHash: string,
    fileName: string,
    totalBytes: number,
    mimeType: string,
  ): Promise<void> {
    this.updateProgress({
      offerId,
      status: 'connecting',
      progress: 0,
      bytesTransferred: 0,
      totalBytes,
    });

    const pc = new RTCPeerConnection({
      iceServers: iceServersService.getIceServers(),
    });

    this.activePeerConnections.set(offerId, pc);

    const receivedChunks: ArrayBuffer[] = [];
    let receivedBytes = 0;

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      channel.binaryType = 'arraybuffer';

      channel.onmessage = async (msgEvent) => {
        if (typeof msgEvent.data === 'string') {
          if (msgEvent.data === 'EOF') {
            channel.close();
            pc.close();
            this.activePeerConnections.delete(offerId);

            // Assemble and verify SHA-256
            const completeBlob = new Blob(receivedChunks, { type: mimeType });
            const completeBuffer = await completeBlob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', completeBuffer);
            const computedHash = Array.from(new Uint8Array(hashBuffer))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');

            if (computedHash.toLowerCase() !== fileHash.toLowerCase()) {
              this.updateProgress({
                offerId,
                status: 'error',
                progress: 0,
                bytesTransferred: 0,
                totalBytes,
                error: 'SHA-256 doğrulama başarısız! Dosya bozulmuş olabilir.',
              });
              return;
            }

            // Trigger file save/download
            const blobUrl = URL.createObjectURL(completeBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            this.updateProgress({
              offerId,
              status: 'completed',
              progress: 100,
              bytesTransferred: totalBytes,
              totalBytes,
            });
          }
          return;
        }

        const chunk = msgEvent.data as ArrayBuffer;
        receivedChunks.push(chunk);
        receivedBytes += chunk.byteLength;

        const progressPercent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
        this.updateProgress({
          offerId,
          status: 'transferring',
          progress: progressPercent,
          bytesTransferred: receivedBytes,
          totalBytes,
        });
      };
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        echoWebSocketService.sendFileSignal(targetUserId, {
          type: 'candidate',
          offerId,
          candidate: event.candidate,
        });
      }
    };

    // Request sender to initiate data channel offer
    echoWebSocketService.sendFileSignal(targetUserId, {
      type: 'request-file',
      offerId,
      fileHash,
    });
  }

  async handleSignal(fromUserId: string, rawSignal: unknown): Promise<void> {
    const signal = rawSignal as {
      type: string;
      offerId: string;
      fileHash?: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };

    if (!signal?.offerId) return;

    if (signal.type === 'request-file' && signal.fileHash) {
      // We are sender
      const file = this.localFiles.get(signal.fileHash);
      if (!file) {
        echoWebSocketService.sendFileSignal(fromUserId, {
          type: 'error',
          offerId: signal.offerId,
          error: 'Dosya artık paylaşıma açık değil.',
        });
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: iceServersService.getIceServers(),
      });
      this.activePeerConnections.set(signal.offerId, pc);

      const channel = pc.createDataChannel('file-transfer', { ordered: true });
      channel.binaryType = 'arraybuffer';

      channel.onopen = async () => {
        let offset = 0;
        const totalSize = file.size;

        const sendNextChunk = (): void => {
          while (offset < totalSize) {
            if (channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
              channel.onbufferedamountlow = () => {
                channel.onbufferedamountlow = null;
                sendNextChunk();
              };
              return;
            }

            const slice = file.slice(offset, offset + CHUNK_SIZE);
            slice.arrayBuffer().then((buffer) => {
              try {
                if (channel.readyState === 'open') {
                  channel.send(buffer);
                }
              } catch (err) {
                console.warn('Channel send error:', err);
              }
            });

            offset += CHUNK_SIZE;
          }

          // EOF signal
          const checkFinished = setInterval(() => {
            if (channel.bufferedAmount === 0) {
              clearInterval(checkFinished);
              if (channel.readyState === 'open') {
                channel.send('EOF');
              }
            }
          }, 50);
        };

        sendNextChunk();
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          echoWebSocketService.sendFileSignal(fromUserId, {
            type: 'candidate',
            offerId: signal.offerId,
            candidate: event.candidate,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      echoWebSocketService.sendFileSignal(fromUserId, {
        type: 'offer',
        offerId: signal.offerId,
        sdp: pc.localDescription,
      });
      return;
    }

    const pc = this.activePeerConnections.get(signal.offerId);
    if (!pc) return;

    if (signal.type === 'offer' && signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      echoWebSocketService.sendFileSignal(fromUserId, {
        type: 'answer',
        offerId: signal.offerId,
        sdp: pc.localDescription,
      });
    } else if (signal.type === 'answer' && signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    } else if (signal.type === 'candidate' && signal.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((err) => {
        console.warn('Failed to add candidate:', err);
      });
    } else if (signal.type === 'error') {
      this.updateProgress({
        offerId: signal.offerId,
        status: 'error',
        progress: 0,
        bytesTransferred: 0,
        totalBytes: 0,
        error: (signal as { error?: string }).error || 'Dosya transfer hatası.',
      });
    }
  }
}

export const p2pFileTransferService = new P2PFileTransferService();
