import { WsClientEvents, WsServerEvents } from '@echo/shared';
import { useAuthStore } from '../stores/useAuthStore';
import { useDmStore } from '../stores/useDmStore';
import { SERVER_HTTP_URL, SERVER_WS_URL } from '../config';
class DmWebSocketService {
    ws = null;
    reconnectTimeout = null;
    pingInterval = null;
    reconnectAttempt = 0;
    isIntentionallyClosed = false;
    connect() {
        const identity = useAuthStore.getState().identity;
        if (!identity)
            return;
        if (this.ws &&
            (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        this.disconnect();
        this.isIntentionallyClosed = false;
        void this.initSocket();
    }
    async initSocket() {
        const identity = useAuthStore.getState().identity;
        if (!identity)
            return;
        try {
            const ts = Date.now();
            const signed = await window.echoApi?.signAuth('user', ts);
            if (!signed) {
                throw new Error('DM auth imzalama başarısız');
            }
            const params = new URLSearchParams({
                userId: signed.userId,
                pubkey: signed.pubkey,
                ts: ts.toString(),
                sig: signed.sig,
                displayName: identity.displayName,
                color: identity.avatarColor,
            });
            const wsUrl = `${SERVER_WS_URL}/ws/user?${params.toString()}`;
            const socket = new WebSocket(wsUrl);
            this.ws = socket;
            socket.onopen = () => {
                if (this.ws !== socket)
                    return;
                this.reconnectAttempt = 0;
                // Fetch initial thread list via HTTP
                void this.refreshThreads();
                // 15s ping for hibernation
                this.pingInterval = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send('ping');
                    }
                }, 15_000);
            };
            socket.onmessage = (event) => {
                if (this.ws !== socket)
                    return;
                if (event.data === 'pong')
                    return;
                try {
                    const envelope = JSON.parse(event.data);
                    this.handleEvent(envelope);
                }
                catch (err) {
                    console.warn('Failed to parse incoming DM WS message:', err);
                }
            };
            socket.onclose = () => {
                if (this.ws !== socket)
                    return;
                this.cleanupSocket();
                if (!this.isIntentionallyClosed) {
                    this.scheduleReconnect();
                }
            };
            socket.onerror = (err) => {
                console.warn('DM WebSocket error:', err);
            };
        }
        catch (err) {
            console.error('Failed to init DM socket:', err);
            this.scheduleReconnect();
        }
    }
    handleEvent(envelope) {
        const myUserId = useAuthStore.getState().identity?.userId ?? '';
        switch (envelope.t) {
            case WsServerEvents.DM_NEW: {
                const msg = envelope.d;
                useDmStore.getState().addMessage(msg, myUserId);
                break;
            }
            case WsServerEvents.HISTORY_DATA: {
                const data = envelope.d;
                useDmStore.getState().setMessages(data.peerId, data.messages);
                break;
            }
            case WsServerEvents.DM_READ: {
                const data = envelope.d;
                useDmStore.getState().markThreadRead(data.peerId);
                break;
            }
            default:
                break;
        }
    }
    async refreshThreads() {
        const identity = useAuthStore.getState().identity;
        if (!identity)
            return;
        try {
            const res = await fetch(`${SERVER_HTTP_URL}/api/users/${identity.userId}/dm-threads`);
            if (res.ok) {
                const threads = (await res.json());
                useDmStore.getState().setThreads(threads);
            }
        }
        catch (err) {
            console.warn('Failed to fetch DM threads:', err);
        }
    }
    sendDm(toUserId, content) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('DM WS not connected');
            return;
        }
        this.send(WsClientEvents.DM_SEND, {
            toUserId,
            content,
        });
    }
    fetchHistory(peerId, before, limit = 50) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        this.send(WsClientEvents.DM_HISTORY_FETCH, {
            peerId,
            before,
            limit,
        });
    }
    markRead(peerId, lastReadId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        this.send(WsClientEvents.DM_READ_MARK, {
            peerId,
            lastReadId,
        });
    }
    send(t, d) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ v: 1, t, d }));
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimeout || this.isIntentionallyClosed)
            return;
        const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 15000);
        this.reconnectAttempt++;
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            void this.initSocket();
        }, delay);
    }
    cleanupSocket() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.ws = null;
    }
    disconnect() {
        this.isIntentionallyClosed = true;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.cleanupSocket();
        if (this.ws) {
            this.ws.close(1000, 'Intentional close');
            this.ws = null;
        }
    }
}
export const dmWebSocketService = new DmWebSocketService();
