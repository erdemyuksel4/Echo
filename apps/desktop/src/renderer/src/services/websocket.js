import { WsClientEvents, WsServerEvents, } from '@echo/shared';
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
    activeGroupId = null;
    sockets = new Map();
    lastTypingSentTime = 0;
    connect(groupId) {
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
                }
                else {
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
    initSocket(groupId) {
        const prev = this.sockets.get(groupId);
        if (prev) {
            this.cleanupSocketTimers(prev);
            if (prev.ws.readyState === WebSocket.OPEN || prev.ws.readyState === WebSocket.CONNECTING) {
                prev.isIntentionallyClosed = true;
                try {
                    prev.ws.close(1000, 'Re-initializing');
                }
                catch {
                    // ignore
                }
            }
        }
        if (groupId === this.activeGroupId) {
            useChatStore.getState().setConnectionStatus('connecting');
        }
        const wsUrl = `${SERVER_WS_URL}/ws/group/${groupId}`;
        const socket = new WebSocket(wsUrl);
        const managed = {
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
            if (managed.ws !== socket)
                return;
            managed.reconnectAttempt = 0;
            // Perform auth signature immediately
            try {
                const timestamp = Date.now();
                const signed = await window.echoApi?.signAuth(groupId, timestamp);
                if (!signed) {
                    throw new Error('İmzalama başarısız');
                }
                const authPayload = {
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
            }
            catch (err) {
                console.error(`Failed to sign auth for WebSocket (${groupId}):`, err);
                socket.close(4001, 'Auth sign failed');
            }
        };
        socket.onmessage = (event) => {
            if (managed.ws !== socket)
                return;
            if (event.data === 'pong')
                return; // Pong reply from DO hibernation auto-response
            try {
                const envelope = JSON.parse(event.data);
                this.handleEvent(groupId, envelope);
            }
            catch (err) {
                console.warn(`Failed to parse incoming WS message (${groupId}):`, err);
            }
        };
        socket.onclose = (event) => {
            if (managed.ws !== socket)
                return;
            this.cleanupSocketTimers(managed);
            managed.isAuthenticated = false;
            if (groupId === this.activeGroupId) {
                useChatStore.getState().setConnectionStatus('disconnected');
            }
            const isForbidden = event.code === 4003;
            const isAuthExhausted = event.code === 4001 && managed.reconnectAttempt >= 3;
            if (!managed.isIntentionallyClosed && !isForbidden && !isAuthExhausted) {
                this.scheduleReconnect(groupId);
            }
            else {
                this.sockets.delete(groupId);
            }
        };
        socket.onerror = (err) => {
            console.warn(`WebSocket error (${groupId}):`, err);
        };
        return managed;
    }
    handleEvent(groupId, envelope) {
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
                const snapshot = envelope.d;
                chatStore.setSnapshot(snapshot.group, snapshot.channels, snapshot.members, snapshot.inviteCode);
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
                const message = envelope.d;
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
                    const isMentioned = currentUserName &&
                        (message.content.includes(`@${currentUserName}`) ||
                            message.content.includes('@everyone'));
                    if (document.hidden ||
                        !isActive ||
                        chatStore.activeChannelId !== message.channelId ||
                        isMentioned) {
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
                    const data = envelope.d;
                    chatStore.updateMessage(data.channelId, data.messageId, data.content, data.editedAt);
                }
                break;
            }
            case WsServerEvents.MSG_DELETED: {
                if (isActive) {
                    const data = envelope.d;
                    chatStore.deleteMessage(data.channelId, data.messageId);
                }
                break;
            }
            case WsServerEvents.REACT_UPDATED: {
                if (isActive) {
                    const data = envelope.d;
                    chatStore.updateReactions(data.channelId, data.messageId, data.reactions);
                }
                break;
            }
            case WsServerEvents.HISTORY_DATA: {
                if (isActive) {
                    const data = envelope.d;
                    chatStore.setHistory(data.channelId, data.messages);
                }
                break;
            }
            case WsServerEvents.TYPING_USER: {
                if (isActive) {
                    const data = envelope.d;
                    chatStore.setTypingUser(data.channelId, data.displayName);
                }
                break;
            }
            case WsServerEvents.PRESENCE_CHANGED: {
                if (isActive) {
                    const data = envelope.d;
                    chatStore.setMemberPresence(data.userId, data.status);
                }
                break;
            }
            case WsServerEvents.CHANNEL_CREATED: {
                if (isActive) {
                    const channel = envelope.d;
                    chatStore.addChannel(channel);
                }
                break;
            }
            case WsServerEvents.CHANNEL_UPDATED: {
                if (isActive) {
                    const data = envelope.d;
                    chatStore.updateChannel(data.channelId, data.name);
                }
                break;
            }
            case WsServerEvents.CHANNEL_DELETED: {
                if (isActive) {
                    const data = envelope.d;
                    chatStore.removeChannel(data.channelId);
                }
                break;
            }
            case WsServerEvents.MEMBER_JOINED: {
                if (isActive) {
                    const member = envelope.d;
                    chatStore.addMember(member);
                }
                break;
            }
            case WsServerEvents.MEMBER_LEFT: {
                if (isActive) {
                    const data = envelope.d;
                    chatStore.removeMember(data.userId);
                }
                break;
            }
            case WsServerEvents.GROUP_DELETED: {
                const data = envelope.d;
                chatStore.removeGroup(data.groupId);
                if (useVoiceStore.getState().currentGroupId === data.groupId) {
                    webrtcService.leave();
                }
                this.closeSocket(data.groupId);
                break;
            }
            case WsServerEvents.VOICE_USER_JOINED: {
                const data = envelope.d;
                const myUserId = useAuthStore.getState().identity?.userId;
                const voiceStore = useVoiceStore.getState();
                if (data.userId === myUserId) {
                    // When current user joins, update full participant list including existing ones and self
                    const allParticipants = [
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
                }
                else {
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
                    webrtcService.handleUserJoined(data.channelId, data.userId, data.displayName, data.currentParticipants);
                }
                break;
            }
            case WsServerEvents.VOICE_USER_LEFT: {
                const data = envelope.d;
                useVoiceStore.getState().removeChannelParticipant(data.channelId, data.userId);
                webrtcService.handleUserLeft(data.channelId, data.userId);
                break;
            }
            case WsServerEvents.VOICE_SIGNAL: {
                const data = envelope.d;
                const currentChannelId = useVoiceStore.getState().currentChannelId;
                if (currentChannelId && data.channelId === currentChannelId) {
                    void webrtcService.handleSignal(data.fromUserId, data.signal, data.channelId);
                }
                break;
            }
            case WsServerEvents.VOICE_STATE: {
                const data = envelope.d;
                useVoiceStore.getState().updateChannelParticipantState(data.channelId, data.userId, {
                    muted: data.muted,
                    deafened: data.deafened,
                    speaking: data.speaking,
                    camera: data.camera,
                });
                break;
            }
            case WsServerEvents.VOICE_PARTICIPANTS: {
                const data = envelope.d;
                useVoiceStore.getState().setChannelParticipants(data.channelId, data.participants);
                break;
            }
            case WsServerEvents.FILE_SIGNAL: {
                const data = envelope.d;
                void p2pFileTransferService.handleSignal(data.fromUserId, data.signal);
                break;
            }
            case WsServerEvents.SHARE_STARTED: {
                const data = envelope.d;
                useScreenShareStore.getState().addOrUpdateShare(data);
                break;
            }
            case WsServerEvents.SHARE_STOPPED: {
                const data = envelope.d;
                useScreenShareStore.getState().removeShare(data.userId);
                break;
            }
            case WsServerEvents.SHARE_ACTIVE_LIST: {
                const data = envelope.d;
                useScreenShareStore.getState().setActiveShares(data.shares);
                break;
            }
            case WsServerEvents.SHARE_SIGNAL: {
                const data = envelope.d;
                void screenShareTransport.handleSignal(data.fromUserId, data.channelId, data.signal);
                break;
            }
            case WsServerEvents.ERROR: {
                const data = envelope.d;
                console.error(`Server error (${groupId}):`, data.code, data.message);
                break;
            }
        }
    }
    sendMessage(channelId, content, replyTo, attachments) {
        const trimmed = content.trim();
        if (!trimmed && (!attachments || attachments.length === 0))
            return;
        this.send(WsClientEvents.MSG_SEND, {
            channelId,
            content: trimmed,
            replyTo: replyTo ?? null,
            attachments: attachments ?? [],
        });
    }
    editMessage(channelId, messageId, content) {
        if (!content.trim())
            return;
        this.send(WsClientEvents.MSG_EDIT, {
            channelId,
            messageId,
            content: content.trim(),
        });
    }
    deleteMessage(channelId, messageId) {
        this.send(WsClientEvents.MSG_DELETE, {
            channelId,
            messageId,
        });
    }
    addReaction(channelId, messageId, emoji) {
        this.send(WsClientEvents.REACT_ADD, {
            channelId,
            messageId,
            emoji,
        });
    }
    removeReaction(channelId, messageId, emoji) {
        this.send(WsClientEvents.REACT_REMOVE, {
            channelId,
            messageId,
            emoji,
        });
    }
    sendTyping(channelId) {
        const now = Date.now();
        if (now - this.lastTypingSentTime < 3000)
            return; // En fazla 3 saniyede bir
        this.lastTypingSentTime = now;
        this.send(WsClientEvents.TYPING, { channelId });
    }
    fetchHistory(channelId, before) {
        this.send(WsClientEvents.HISTORY_FETCH, {
            channelId,
            before,
            limit: 50,
        });
    }
    createChannel(name, type) {
        this.send(WsClientEvents.CHANNEL_CREATE, {
            name: name.trim().toLowerCase().replace(/\s+/g, '-'),
            type,
        });
    }
    deleteChannel(channelId) {
        this.send(WsClientEvents.CHANNEL_DELETE, { channelId });
    }
    joinVoice(groupId, channelId) {
        let managed = this.sockets.get(groupId);
        if (!managed || managed.ws.readyState !== WebSocket.OPEN) {
            managed = this.initSocket(groupId);
        }
        this.sendToGroup(groupId, WsClientEvents.VOICE_JOIN, { channelId });
    }
    leaveVoice(channelId, targetGroupId) {
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
    sendVoiceSignal(channelId, targetUserId, signal) {
        const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
        if (!gId)
            return;
        this.sendToGroup(gId, WsClientEvents.VOICE_SIGNAL, {
            channelId,
            targetUserId,
            signal,
        });
    }
    sendVoiceState(channelId, state) {
        const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
        if (!gId)
            return;
        this.sendToGroup(gId, WsClientEvents.VOICE_STATE, {
            channelId,
            ...state,
        });
    }
    sendFileSignal(targetUserId, signal) {
        this.send(WsClientEvents.FILE_SIGNAL, {
            targetUserId,
            signal,
        });
    }
    sendShareStart(channelId, quality, mode, hasAudio) {
        const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
        if (!gId)
            return;
        this.sendToGroup(gId, WsClientEvents.SHARE_START, {
            channelId,
            quality,
            mode,
            hasAudio,
        });
    }
    sendShareStop(channelId) {
        const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
        if (!gId)
            return;
        this.sendToGroup(gId, WsClientEvents.SHARE_STOP, { channelId });
    }
    sendShareSignal(channelId, targetUserId, signal) {
        const gId = useVoiceStore.getState().currentGroupId ?? this.activeGroupId;
        if (!gId)
            return;
        this.sendToGroup(gId, WsClientEvents.SHARE_SIGNAL, {
            channelId,
            targetUserId,
            signal,
        });
    }
    send(type, data) {
        if (this.activeGroupId) {
            this.sendToGroup(this.activeGroupId, type, data);
        }
    }
    sendToGroup(groupId, type, data) {
        const managed = this.sockets.get(groupId);
        if (!managed)
            return;
        const payload = {
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
        }
        else if (managed.ws.readyState === WebSocket.CONNECTING ||
            (managed.ws.readyState === WebSocket.OPEN && !managed.isAuthenticated)) {
            if (managed.pendingQueue.length < 50) {
                managed.pendingQueue.push(payload);
            }
        }
    }
    scheduleReconnect(groupId) {
        const managed = this.sockets.get(groupId);
        if (!managed)
            return;
        managed.reconnectAttempt++;
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
        const delay = Math.min(1000 * Math.pow(2, managed.reconnectAttempt - 1), 30_000);
        managed.reconnectTimeout = setTimeout(() => {
            this.initSocket(groupId);
        }, delay);
    }
    cleanupSocketTimers(managed) {
        if (managed.pingInterval) {
            clearInterval(managed.pingInterval);
            managed.pingInterval = null;
        }
        if (managed.reconnectTimeout) {
            clearTimeout(managed.reconnectTimeout);
            managed.reconnectTimeout = null;
        }
    }
    closeSocket(groupId) {
        const managed = this.sockets.get(groupId);
        if (!managed)
            return;
        managed.isIntentionallyClosed = true;
        this.cleanupSocketTimers(managed);
        if (managed.ws.readyState === WebSocket.OPEN ||
            managed.ws.readyState === WebSocket.CONNECTING) {
            try {
                managed.ws.close(1000, 'Intentional close');
            }
            catch {
                // ignore
            }
        }
        this.sockets.delete(groupId);
    }
    disconnect() {
        this.activeGroupId = null;
        useChatStore.getState().setConnectionStatus('disconnected');
    }
    disconnectAll() {
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
