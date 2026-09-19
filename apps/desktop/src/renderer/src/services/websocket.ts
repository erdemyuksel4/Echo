import {
  WsClientEvents,
  WsServerEvents,
  type WsEnvelope,
  type GroupSnapshot,
  type Message,
  type Channel,
  type GroupMember,
  type VoiceParticipant,
  type VoiceSignalData,
  type Attachment,
  type ScreenShareState,
  type ScreenQualityPreset,
} from '@echo/shared';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { soundService } from './sound';
import { SERVER_WS_URL } from '../config';
import { webrtcService } from './webrtc';
import { p2pFileTransferService } from './p2pFileTransfer';
import { screenShareTransport } from './screenShare/transport';

class EchoWebSocketService {
  private ws: WebSocket | null = null;
  private currentGroupId: string | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private isIntentionallyClosed = false;

  connect(groupId: string): void {
    if (this.currentGroupId === groupId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.disconnect();
    this.currentGroupId = groupId;
    this.isIntentionallyClosed = false;

    this.initSocket();
  }

  private initSocket(): void {
    if (!this.currentGroupId) return;

    useChatStore.getState().setConnectionStatus('connecting');

    const wsUrl = `${SERVER_WS_URL}/ws/group/${this.currentGroupId}`;
    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.onopen = async () => {
      if (this.ws !== socket) return;
      this.reconnectAttempt = 0;

      // Perform auth signature immediately
      try {
        const timestamp = Date.now();
        const signed = await window.echoApi?.signAuth(this.currentGroupId!, timestamp);
        if (!signed) {
          throw new Error('İmzalama başarısız');
        }

        this.send(WsClientEvents.AUTH, {
          userId: signed.userId,
          pubkey: signed.pubkey,
          ts: timestamp,
          sig: signed.sig,
        });

        // Setup 30s ping
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          }
        }, 30_000);
      } catch (err) {
        console.error('Failed to sign auth for WebSocket:', err);
        socket.close(4001, 'Auth sign failed');
      }
    };

    socket.onmessage = (event) => {
      if (this.ws !== socket) return;
      if (event.data === 'pong') return; // Pong reply from DO hibernation auto-response

      try {
        const envelope: WsEnvelope = JSON.parse(event.data);
        this.handleEvent(envelope);
      } catch (err) {
        console.warn('Failed to parse incoming WS message:', err);
      }
    };

    socket.onclose = (event) => {
      if (this.ws !== socket) return;
      this.cleanupSocket();

      useChatStore.getState().setConnectionStatus('disconnected');

      if (!this.isIntentionallyClosed && event.code !== 4001 && event.code !== 4003) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = (err) => {
      console.warn('WebSocket error:', err);
    };
  }

  private handleEvent(envelope: WsEnvelope): void {
    const chatStore = useChatStore.getState();

    switch (envelope.t) {
      case WsServerEvents.AUTH_OK:
        chatStore.setConnectionStatus('connected');
        break;

      case WsServerEvents.SNAPSHOT: {
        const snapshot = envelope.d as GroupSnapshot;
        chatStore.setSnapshot(
          snapshot.group,
          snapshot.channels,
          snapshot.members,
          snapshot.inviteCode,
        );

        // Fetch history for first active channel
        const activeChanId = chatStore.activeChannelId;
        if (activeChanId) {
          this.fetchHistory(activeChanId);
        }
        break;
      }

      case WsServerEvents.MSG_NEW: {
        const message = envelope.d as Message;
        chatStore.addMessage(message.channelId, message);

        const currentUserId = useAuthStore.getState().identity?.userId;
        const currentUserName = useAuthStore.getState().identity?.displayName;

        // Sound and notification if sent by another user
        if (currentUserId && message.authorId !== currentUserId) {
          soundService.playNotification();

          const channel = chatStore.channels.find((c) => c.id === message.channelId);
          const chanName = channel ? `#${channel.name}` : 'Sohbet';
          const isMentioned =
            currentUserName &&
            (message.content.includes(`@${currentUserName}`) || message.content.includes('@everyone'));

          if (document.hidden || chatStore.activeChannelId !== message.channelId || isMentioned) {
            void window.echoApi?.showNotification({
              title: `${message.authorName} (${chanName})`,
              body: message.content.slice(0, 120),
            });
          }

          const updatedUnreads = useChatStore.getState().unreadCounts;
          const totalUnread = Object.values(updatedUnreads).reduce((a, b) => a + b, 0);
          void window.echoApi?.setBadgeCount(totalUnread);
        }
        break;
      }

      case WsServerEvents.MSG_UPDATED: {
        const data = envelope.d as {
          channelId: string;
          messageId: string;
          content: string;
          editedAt: number;
        };
        chatStore.updateMessage(data.channelId, data.messageId, data.content, data.editedAt);
        break;
      }

      case WsServerEvents.MSG_DELETED: {
        const data = envelope.d as { channelId: string; messageId: string };
        chatStore.deleteMessage(data.channelId, data.messageId);
        break;
      }

      case WsServerEvents.REACT_UPDATED: {
        const data = envelope.d as {
          channelId: string;
          messageId: string;
          emoji: string;
          reactions: Record<string, string[]>;
        };
        chatStore.updateReactions(data.channelId, data.messageId, data.reactions);
        break;
      }

      case WsServerEvents.HISTORY_DATA: {
        const data = envelope.d as { channelId: string; messages: Message[] };
        chatStore.setHistory(data.channelId, data.messages);
        break;
      }

      case WsServerEvents.TYPING_USER: {
        const data = envelope.d as { channelId: string; displayName: string };
        chatStore.setTypingUser(data.channelId, data.displayName);
        break;
      }

      case WsServerEvents.PRESENCE_CHANGED: {
        const data = envelope.d as { userId: string; status: 'online' | 'idle' | 'offline' };
        chatStore.setMemberPresence(data.userId, data.status);
        break;
      }

      case WsServerEvents.CHANNEL_CREATED: {
        const channel = envelope.d as Channel;
        chatStore.addChannel(channel);
        break;
      }

      case WsServerEvents.CHANNEL_UPDATED: {
        const data = envelope.d as { channelId: string; name: string };
        chatStore.updateChannel(data.channelId, data.name);
        break;
      }

      case WsServerEvents.CHANNEL_DELETED: {
        const data = envelope.d as { channelId: string };
        chatStore.removeChannel(data.channelId);
        break;
      }

      case WsServerEvents.MEMBER_JOINED: {
        const member = envelope.d as GroupMember;
        chatStore.addMember(member);
        break;
      }

      case WsServerEvents.MEMBER_LEFT: {
        const data = envelope.d as { groupId: string; userId: string };
        chatStore.removeMember(data.userId);
        break;
      }

      case WsServerEvents.GROUP_DELETED: {
        const data = envelope.d as { groupId: string };
        chatStore.removeGroup(data.groupId);
        if (useVoiceStore.getState().currentChannelId) {
          webrtcService.leave();
        }
        break;
      }

      case WsServerEvents.VOICE_USER_JOINED: {
        const data = envelope.d as {
          channelId: string;
          userId: string;
          displayName: string;
          currentParticipants: VoiceParticipant[];
        };
        const myUserId = useAuthStore.getState().identity?.userId;
        const voiceStore = useVoiceStore.getState();

        if (data.userId === myUserId) {
          // When current user joins, update full participant list including existing ones and self
          const allParticipants: VoiceParticipant[] = [
            ...data.currentParticipants.filter((p) => p.userId !== data.userId),
            {
              userId: data.userId,
              displayName: data.displayName,
              muted: voiceStore.isMuted,
              deafened: voiceStore.isDeafened,
              speaking: false,
            },
          ];
          voiceStore.setChannelParticipants(data.channelId, allParticipants);
        } else {
          // Another user joined: add them to participants list
          voiceStore.addChannelParticipant(data.channelId, {
            userId: data.userId,
            displayName: data.displayName,
            muted: false,
            deafened: false,
            speaking: false,
          });
        }

        webrtcService.handleUserJoined(
          data.channelId,
          data.userId,
          data.displayName,
          data.currentParticipants,
        );
        break;
      }

      case WsServerEvents.VOICE_USER_LEFT: {
        const data = envelope.d as { channelId: string; userId: string };
        useVoiceStore.getState().removeChannelParticipant(data.channelId, data.userId);
        webrtcService.handleUserLeft(data.channelId, data.userId);
        break;
      }

      case WsServerEvents.VOICE_SIGNAL: {
        const data = envelope.d as {
          channelId: string;
          fromUserId: string;
          signal: VoiceSignalData;
        };
        void webrtcService.handleSignal(data.fromUserId, data.signal);
        break;
      }

      case WsServerEvents.VOICE_STATE: {
        const data = envelope.d as {
          channelId: string;
          userId: string;
          muted: boolean;
          deafened: boolean;
          speaking: boolean;
        };
        useVoiceStore.getState().updateChannelParticipantState(data.channelId, data.userId, {
          muted: data.muted,
          deafened: data.deafened,
          speaking: data.speaking,
        });
        break;
      }

      case WsServerEvents.VOICE_PARTICIPANTS: {
        const data = envelope.d as {
          channelId: string;
          participants: VoiceParticipant[];
        };
        useVoiceStore.getState().setChannelParticipants(data.channelId, data.participants);
        break;
      }

      case WsServerEvents.FILE_SIGNAL: {
        const data = envelope.d as {
          fromUserId: string;
          signal: unknown;
        };
        void p2pFileTransferService.handleSignal(data.fromUserId, data.signal);
        break;
      }

      case WsServerEvents.SHARE_STARTED: {
        const data = envelope.d as ScreenShareState;
        useScreenShareStore.getState().addOrUpdateShare(data);
        break;
      }

      case WsServerEvents.SHARE_STOPPED: {
        const data = envelope.d as { channelId: string; userId: string };
        useScreenShareStore.getState().removeShare(data.userId);
        break;
      }

      case WsServerEvents.SHARE_ACTIVE_LIST: {
        const data = envelope.d as { channelId: string; shares: ScreenShareState[] };
        useScreenShareStore.getState().setActiveShares(data.shares);
        break;
      }

      case WsServerEvents.SHARE_SIGNAL: {
        const data = envelope.d as { channelId: string; fromUserId: string; signal: unknown };
        void screenShareTransport.handleSignal(data.fromUserId, data.channelId, data.signal);
        break;
      }

      case WsServerEvents.ERROR: {
        const data = envelope.d as { code: string; message: string };
        console.error('Server error:', data.code, data.message);
        break;
      }
    }
  }

  sendMessage(
    channelId: string,
    content: string,
    replyTo?: string,
    attachments?: Attachment[],
  ): void {
    const trimmed = content.trim();
    if (!trimmed && (!attachments || attachments.length === 0)) return;
    this.send(WsClientEvents.MSG_SEND, {
      channelId,
      content: trimmed,
      replyTo: replyTo ?? null,
      attachments: attachments ?? [],
    });
  }

  editMessage(channelId: string, messageId: string, content: string): void {
    if (!content.trim()) return;
    this.send(WsClientEvents.MSG_EDIT, {
      channelId,
      messageId,
      content: content.trim(),
    });
  }

  deleteMessage(channelId: string, messageId: string): void {
    this.send(WsClientEvents.MSG_DELETE, {
      channelId,
      messageId,
    });
  }

  addReaction(channelId: string, messageId: string, emoji: string): void {
    this.send(WsClientEvents.REACT_ADD, {
      channelId,
      messageId,
      emoji,
    });
  }

  removeReaction(channelId: string, messageId: string, emoji: string): void {
    this.send(WsClientEvents.REACT_REMOVE, {
      channelId,
      messageId,
      emoji,
    });
  }

  private lastTypingSentTime = 0;

  sendTyping(channelId: string): void {
    const now = Date.now();
    if (now - this.lastTypingSentTime < 3000) return; // En fazla 3 saniyede bir
    this.lastTypingSentTime = now;
    this.send(WsClientEvents.TYPING, { channelId });
  }

  fetchHistory(channelId: string, before?: string): void {
    this.send(WsClientEvents.HISTORY_FETCH, {
      channelId,
      before,
      limit: 50,
    });
  }

  createChannel(name: string, type: 'text' | 'voice'): void {
    this.send(WsClientEvents.CHANNEL_CREATE, {
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      type,
    });
  }

  deleteChannel(channelId: string): void {
    this.send(WsClientEvents.CHANNEL_DELETE, { channelId });
  }

  joinVoice(channelId: string): void {
    this.send(WsClientEvents.VOICE_JOIN, { channelId });
  }

  leaveVoice(channelId: string): void {
    this.send(WsClientEvents.VOICE_LEAVE, { channelId });
  }

  sendVoiceSignal(channelId: string, targetUserId: string, signal: VoiceSignalData): void {
    this.send(WsClientEvents.VOICE_SIGNAL, {
      channelId,
      targetUserId,
      signal,
    });
  }

  sendVoiceState(
    channelId: string,
    state: { muted: boolean; deafened: boolean; speaking: boolean },
  ): void {
    this.send(WsClientEvents.VOICE_STATE, {
      channelId,
      ...state,
    });
  }

  sendFileSignal(targetUserId: string, signal: unknown): void {
    this.send(WsClientEvents.FILE_SIGNAL, {
      targetUserId,
      signal,
    });
  }

  sendShareStart(
    channelId: string,
    quality: ScreenQualityPreset,
    mode: 'motion' | 'detail',
    hasAudio: boolean,
  ): void {
    this.send(WsClientEvents.SHARE_START, {
      channelId,
      quality,
      mode,
      hasAudio,
    });
  }

  sendShareStop(channelId: string): void {
    this.send(WsClientEvents.SHARE_STOP, { channelId });
  }

  sendShareSignal(channelId: string, targetUserId: string, signal: unknown): void {
    this.send(WsClientEvents.SHARE_SIGNAL, {
      channelId,
      targetUserId,
      signal,
    });
  }

  private send(type: string, data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload: WsEnvelope = {
        v: 1,
        t: type,
        d: data,
      };
      this.ws.send(JSON.stringify(payload));
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 30_000);
    this.reconnectTimeout = setTimeout(() => {
      this.initSocket();
    }, delay);
  }

  private cleanupSocket(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    webrtcService.leave();
    this.cleanupSocket();
    if (this.ws) {
      this.ws.close(1000, 'Intentional close');
      this.ws = null;
    }
    this.currentGroupId = null;
  }
}

export const wsService = new EchoWebSocketService();
export const echoWebSocketService = wsService;
