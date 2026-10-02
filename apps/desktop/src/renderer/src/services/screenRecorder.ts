import { useRecordingStore } from '../stores/useRecordingStore';

class ScreenRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private currentStream: MediaStream | null = null;
  private currentTargetName = '';

  private getSupportedMimeType(): string {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const mime of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  }

  public isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  public startRecording(stream: MediaStream, targetName: string): boolean {
    if (this.isRecording()) {
      console.warn('[ScreenRecorder] Zaten aktif bir kayıt var.');
      return false;
    }

    if (!stream || stream.getVideoTracks().length === 0) {
      console.error('[ScreenRecorder] Kayıt için geçerli video akışı bulunamadı.');
      return false;
    }

    try {
      this.recordedChunks = [];
      this.currentStream = stream;
      this.currentTargetName = targetName;

      const mimeType = this.getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.startTime = Date.now();
        useRecordingStore.getState().setRecording(true, targetName);

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
          useRecordingStore.getState().setDuration(elapsedSeconds);
        }, 1000);
      };

      // If the stream ends unexpectedly (e.g. streamer stops sharing), automatically finalize recording
      const firstVideoTrack = stream.getVideoTracks()[0];
      if (firstVideoTrack) {
        firstVideoTrack.addEventListener('ended', () => {
          if (this.isRecording()) {
            void this.stopRecording();
          }
        }, { once: true });
      }

      this.mediaRecorder.start(1000); // chunk every 1 second
      return true;
    } catch (err) {
      console.error('[ScreenRecorder] Kayıt başlatılırken hata oluştu:', err);
      this.cleanup();
      return false;
    }
  }

  public async stopRecording(): Promise<{ canceled: boolean; filePath: string | null; error?: string }> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.cleanup();
      return { canceled: true, filePath: null };
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanup();
        resolve({ canceled: true, filePath: null });
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          useRecordingStore.getState().setIsSaving(true);

          const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
          const recordedBlob = new Blob(this.recordedChunks, { type: mimeType });
          const arrayBuffer = await recordedBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const sanitizedName = (this.currentTargetName || 'Yayin')
            .replace(/[\\/:*?"<>|]/g, '_')
            .trim();
          const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
          const defaultFileName = `Echo-${sanitizedName}-${dateStr}.webm`;

          const result = await window.echoApi.saveRecordedVideo({
            defaultName: defaultFileName,
            buffer: uint8Array,
          });

          if (!result.canceled && result.filePath) {
            void window.echoApi.showNotification({
              title: 'Ekran Kaydı Başarıyla Kaydedildi',
              body: `Dosya: ${result.filePath}`,
              silent: false,
            });
          }

          resolve(result);
        } catch (error) {
          console.error('[ScreenRecorder] Kayıt kaydedilemedi:', error);
          resolve({ canceled: false, filePath: null, error: String(error) });
        } finally {
          this.cleanup();
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.error('[ScreenRecorder] mediaRecorder.stop() hatası:', err);
        this.cleanup();
        resolve({ canceled: true, filePath: null, error: String(err) });
      }
    });
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.currentStream = null;
    this.currentTargetName = '';
    useRecordingStore.getState().reset();
  }
}

export const screenRecorderService = new ScreenRecorderService();
