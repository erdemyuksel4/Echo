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

interface ManagedSocket {
  groupId: string;
  ws: WebSocket;
  pingInterval: ReturnType<typeof setInterval> | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
  isIntentionallyClosed: boolean;
  isAuthenticated: boolean;
  pendingQueue: WsEnvelope[];
}

class EchoWebSocketService {
  private activeGroupId: string | null = null;
  private sockets: Map<string, ManagedSocket> = new Map();
  private lastTypingSentTime = 0;

  connect(groupId: string): void {
    this.activeGroupId = groupId;

    const existing = this.sockets.get(groupId);
    if (existing) {
      if (existing.ws.readyState === WebSocket.OPEN) {
        if (existing.isAuthenticated) {
          useChatStore.getState().setConnectionStatus('connected');
          const currentChanId = useChatStore.getState().activeChannelId;
          if (currentChanId) {
            this.fetchHistory(currentChanId);
          }
        } else {
          useChatStore.getState().setConnectionStatus('connecting');
        }
        return;
      }
      if (existing.ws.readyState === WebSocket.CONNECTING) {
        useChatStore.getState().setConnectionStatus('connecting');
        return;
      }
    }

    this.initSocket(groupId);
  }

  private initSocket(groupId: string): ManagedSocket {
    const prev = this.sockets.get(groupId);
    if (prev) {
      this.cleanupSocketTimers(prev);
      if (prev.ws.readyState === WebSocket.OPEN || prev.ws.readyState === WebSocket.CONNECTING) {
        prev.isIntentionallyClosed = true;
        try {
          prev.ws.close(1000, 'Re-initializing');
        } catch {
          // ignore
        }
      }
    }

    if (groupId === this.activeGroupId) {
      useChatStore.getState().setConnectionStatus('connecting');
    }

    const wsUrl = `${SERVER_WS_URL}/ws/group/${groupId}`;
    const socket = new WebSocket(wsUrl);

    const managed: ManagedSocket = {
      groupId,
      ws: socket,
      pingInterval: null,
      reconnectTimeout: null,
      reconnectAttempt: prev ? prev.reconnectAttempt : 0,
      isIntentionallyClosed: false,
      isAuthenticated: false,
      pendingQueue: [],
    };
    this.sockets.set(groupId, managed);

    socket.onopen = async () => {
      if (managed.ws !== socket) return;
      managed.reconnectAttempt = 0;

      // Perform auth signature immediately
      try {
        const timestamp = Date.now();
        const signed = await window.echoApi?.signAuth(groupId, timestamp);
        if (!signed) {
          throw new Error('İmzalama başarısız');
        }

        const authPayload: WsEnvelope = {
          v: 1,
          t: WsClientEvents.AUTH,
          d: {
            userId: signed.userId,
            pubkey: signed.pubkey,
            ts: timestamp,
            sig: signed.sig,
          },
        };
        socket.send(JSON.stringify(authPayload));

        // Setup 15s ping for aggressive keepalive against edge proxy drops
        managed.pingInterval = setInterval(() => {
          if (managed.ws?.readyState === WebSocket.OPEN) {
            managed.ws.send('ping');
          }
        }, 15_000);
      } catch (err) {
        console.error(`Failed to sign auth for WebSocket (${groupId}):`, err);
        socket.close(4001, 'Auth sign failed');
      }
    };

    socket.onmessage = (event) => {
      if (managed.ws !== socket) return;
      if (event.data === 'pong') return; // Pong reply from DO hibernation auto-response

      try {
        const envelope: WsEnvelope = JSON.parse(event.data);
        this.handleEvent(groupId, envelope);
      } catch (err) {
        console.warn(`Failed to parse incoming WS message (${groupId}):`, err);
      }
    };

    socket.onclose = (event) => {
      if (managed.ws !== socket) return;
      this.cleanupSocketTimers(managed);
      managed.isAuthenticated = false;

      if (groupId === this.activeGroupId) {
        useChatStore.getState().setConnectionStatus('disconnected');
      }

      const isForbidden = event.code === 4003;
      const isAuthExhausted = event.code === 4001 && managed.reconnectAttempt >= 3;

      if (!managed.isIntentionallyClosed && !isForbidden && !isAuthExhausted) {
        this.scheduleReconnect(groupId);
      } else {
        this.sockets.delete(groupId);
      }
    };

    socket.onerror = (err) => {
      console.warn(`WebSocket error (${groupId}):`, err);
    };

    return managed;
  }

  private handleEvent(groupId: string, envelope: WsEnvelope): void {
    const chatStore = useChatStore.getState();
    const isActive = groupId === this.activeGroupId;

    switch (envelope.t) {
      case WsServerEvents.AUTH_OK: {
        const managed = this.sockets.get(groupId);
        if (managed) {
          managed.isAuthenticated = true;
          if (managed.pendingQueue.length > 0) {
            for (const env of managed.pendingQueue) {
              if (managed.ws.readyState === WebSocket.OPEN) {
                managed.ws.send(JSON.stringify(env));
              }
            }
            managed.pendingQueue = [];
          }
        }
        if (isActive) {
          chatStore.setConnectionStatus('connected');
        }
        break;
      }

      case WsServerEvents.SNAPSHOT: {
        const snapshot = envelope.d as GroupSnapshot;
        chatStore.setSnapshot(
          snapshot.group,
          snapshot.channels,
          snapshot.members,
          snapshot.inviteCode,
        );

        if (isActive) {
          // Fetch history for first active channel
          const activeChanId = useChatStore.getState().activeChannelId;
          if (activeChanId) {
            this.fetchHistory(activeChanId);
          }
        }
        break;
      }

      case WsServerEvents.MSG_NEW: {
        const message = envelope.d as Message;
        if (isActive) {
          chatStore.addMessage(message.channelId, message);
        }

        const currentUserId = useAuthStore.getState().identity?.userId;
        const currentUserName = useAuthStore.getState().identity?.displayName;

        // Sound and notification if sent by another user
        if (currentUserId && message.authorId !== currentUserId) {
          soundService.playNotification();

          const channel = chatStore.channels.find((c) => c.id === message.channelId);
          const chanName = channel ? `#${channel.name}` : 'Sohbet';
          const isMentioned =
            currentUserName &&
            (message.content.includes(`@${currentUserName}`) ||
              message.content.includes('@everyone'));

          if (
            document.hidden ||
            !isActive ||
            chatStore.activeChannelId !== message.channelId ||
            isMentioned
          ) {
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
        if (isActive) {
          const data = envelope.d as {
            channelId: string;
            messageId: string;
            content: string;
            editedAt: number;
          };
          chatStore.updateMessage(data.channelId, data.messageId, data.content, data.editedAt);
        }
        break;
      }

      case WsServerEvents.MSG_DELETED: {
        if (isActive) {
          const data = envelope.d as { channelId: string; messageId: string };
          chatStore.deleteMessage(data.channelId, data.messageId);
        }
        break;
      }

      case WsServerEvents.REACT_UPDATED: {
        if (isActive) {
          const data = envelope.d as {
            channelId: string;
            messageId: string;
            emoji: string;
            reactions: Record<string, string[]>;
          };
          chatStore.updateReactions(data.channelId, data.messageId, data.reactions);
        }
        break;
      }

      case WsServerEvents.HISTORY_DATA: {
        if (isActive) {
          const data = envelope.d as { channelId: string; messages: Message[] };
          chatStore.setHistory(data.channelId, data.messages);
        }
        break;
      }

      case WsServerEvents.TYPING_USER: {
        if (isActive) {
          const data = envelope.d as { channelId: string; displayName: string };
          chatStore.setTypingUser(data.channelId, data.displayName);
        }
        break;
      }

      case WsServerEvents.PRESENCE_CHANGED: {
        if (isActive) {
          const data = envelope.d as { userId: string; status: 'online' | 'idle' | 'offline' };
          chatStore.setMemberPresence(data.userId, data.status);
        }
        break;
      }

      case WsServerEvents.CHANNEL_CREATED: {
        if (isActive) {
          const channel = envelope.d as Channel;
          chatStore.addChannel(channel);
        }
        break;
      }

      case WsServerEvents.CHANNEL_UPDATED: {
        if (isActive) {
          const data = envelope.d as { channelId: string; name: string };
          chatStore.updateChannel(data.channelId, data.name);
        }
        break;
      }

      case WsServerEvents.CHANNEL_DELETED: {
        if (isActive) {
          const data = envelope.d as { channelId: string };
          chatStore.removeChannel(data.channelId);
        }
        break;
      }

      case WsServerEvents.MEMBER_JOINED: {
        if (isActive) {
          const member = envelope.d as GroupMember;
          chatStore.addMember(member);
        }
        break;
      }

      case WsServerEvents.MEMBER_LEFT: {
        if (isActive) {
          const data = envelope.d as { groupId: string; userId: string };
          chatStore.removeMember(data.userId);
        }
        break;
      }

      case WsServerEvents.GROUP_DELETED: {
        const data = envelope.d as { groupId: string };
        chatStore.removeGroup(data.groupId);
        if (useVoiceStore.getState().currentGroupId === data.groupId) {
          webrtcService.leave();
        }
        this.closeSocket(data.groupId);
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
              camera: false,
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
            camera: false,
          });
        }

        if (data.channelId === voiceStore.currentChannelId) {
          webrtcService.handleUserJoined(
            data.channelId,
            data.userId,
            data.displayName,
            data.currentParticipants,
          );
        }
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
        const currentChannelId = useVoiceStore.getState().currentChannelId;
        if (currentChannelId && data.channelId === currentChannelId) {
          void webrtcService.handleSignal(data.fromUserId, data.signal, data.channelId);
        }
        break;
      }

      case WsServerEvents.VOICE_STATE: {
        const data = envelope.d as {
          channelId: string;
          userId: string;
          muted: boolean;
          deafened: boolean;
          speaking: boolean;
          camera?: boolean;
        };
        useVoiceStore.getState().updateChannelParticipantState(data.channelId, data.userId, {
          muted: data.muted,
          deafened: data.deafened,
          speaking: data.speaking,
          camera: data.camera,
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
        console.error(`Server error (${groupId}):`, data.code, data.message);
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

  joinVoice(groupId: string, channelId: string): void {
    let managed = this.sockets.get(groupId);
    if (!managed || managed.ws.readyState !== WebSocket.OPEN) {
      managed = this.initSocket(groupId);
    }
    this.sendToGroup(groupId, WsClientEvents.VOICE_JOIN, { channelId });
  }

  leaveVoice(channelId: string, targetGroupId?: string): void {
    const gId = targetGroupId ?? useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
    if (gId) {
      this.sendToGroup(gId, WsClientEvents.VOICE_LEAVE, { channelId });
      // If user is currently browsing another group or DM, close this background voice socket
      if (gId !== this.activeGroupId) {
        setTimeout(() => {
          this.closeSocket(gId);
        }, 300);
      }
    }
  }

  sendVoiceSignal(channelId: string, targetUserId: string, signal: VoiceSignalData): void {
    const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
    if (!gId) return;
    this.sendToGroup(gId, WsClientEvents.VOICE_SIGNAL, {
      channelId,
      targetUserId,
      signal,
    });
  }

  sendVoiceState(
    channelId: string,
    state: { muted: boolean; deafened: boolean; speaking: boolean; camera?: boolean },
  ): void {
    const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
    if (!gId) return;
    this.sendToGroup(gId, WsClientEvents.VOICE_STATE, {
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
    const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
    if (!gId) return;
    this.sendToGroup(gId, WsClientEvents.SHARE_START, {
      channelId,
      quality,
      mode,
      hasAudio,
    });
  }

  sendShareStop(channelId: string): void {
    const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
    if (!gId) return;
    this.sendToGroup(gId, WsClientEvents.SHARE_STOP, { channelId });
  }

  sendShareSignal(channelId: string, targetUserId: string, signal: unknown): void {
    const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
    if (!gId) return;
    this.sendToGroup(gId, WsClientEvents.SHARE_SIGNAL, {
      channelId,
      targetUserId,
      signal,
    });
  }

  private send(type: string, data: unknown): void {
    if (this.activeGroupId) {
      this.sendToGroup(this.activeGroupId, type, data);
    }
  }

  private sendToGroup(groupId: string, type: string, data: unknown): void {
    const managed = this.sockets.get(groupId);
    if (!managed) return;

    const payload: WsEnvelope = {
      v: 1,
      t: type,
      d: data,
    };

    if (type === WsClientEvents.AUTH) {
      if (managed.ws.readyState === WebSocket.OPEN) {
        managed.ws.send(JSON.stringify(payload));
      }
      return;
    }

    if (managed.ws.readyState === WebSocket.OPEN && managed.isAuthenticated) {
      managed.ws.send(JSON.stringify(payload));
    } else if (
      managed.ws.readyState === WebSocket.CONNECTING ||
      (managed.ws.readyState === WebSocket.OPEN && !managed.isAuthenticated)
    ) {
      if (managed.pendingQueue.length < 50) {
        managed.pendingQueue.push(payload);
      }
    }
  }

  private scheduleReconnect(groupId: string): void {
    const managed = this.sockets.get(groupId);
    if (!managed) return;

    managed.reconnectAttempt++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
    const delay = Math.min(1000 * Math.pow(2, managed.reconnectAttempt - 1), 30_000);
    managed.reconnectTimeout = setTimeout(() => {
      this.initSocket(groupId);
    }, delay);
  }

  private cleanupSocketTimers(managed: ManagedSocket): void {
    if (managed.pingInterval) {
      clearInterval(managed.pingInterval);
      managed.pingInterval = null;
    }
    if (managed.reconnectTimeout) {
      clearTimeout(managed.reconnectTimeout);
      managed.reconnectTimeout = null;
    }
  }

  private closeSocket(groupId: string): void {
    const managed = this.sockets.get(groupId);
    if (!managed) return;
    managed.isIntentionallyClosed = true;
    this.cleanupSocketTimers(managed);
    if (
      managed.ws.readyState === WebSocket.OPEN ||
      managed.ws.readyState === WebSocket.CONNECTING
    ) {
      try {
        managed.ws.close(1000, 'Intentional close');
      } catch {
        // ignore
      }
    }
    this.sockets.delete(groupId);
  }

  disconnect(): void {
    this.activeGroupId = null;
    useChatStore.getState().setConnectionStatus('disconnected');
  }

  disconnectAll(): void {
    this.activeGroupId = null;
    webrtcService.leave();
    for (const [groupId] of this.sockets) {
      this.closeSocket(groupId);
    }
    this.sockets.clear();
  }
}

export const wsService = new EchoWebSocketService();
export const echoWebSocketService = wsService;
