import { create } from 'zustand';
import type { DmThread, DmMessage } from '@echo/shared';
import { soundService } from '../services/sound';

export interface ActivePeer {
  peerId: string;
  peerName: string;
  peerColor: string;
}

interface DmState {
  threads: DmThread[];
  messages: Record<string, DmMessage[]>; // peerId -> DmMessage[]
  activePeer: ActivePeer | null;
  hasMoreHistory: Record<string, boolean>;

  setThreads: (threads: DmThread[]) => void;
  setActivePeer: (peer: ActivePeer | null) => void;
  addMessage: (msg: DmMessage, myUserId: string) => void;
  setMessages: (peerId: string, msgs: DmMessage[]) => void;
  prependMessages: (peerId: string, msgs: DmMessage[]) => void;
  markThreadRead: (peerId: string) => void;
  clearUnread: (peerId: string) => void;
}

export const useDmStore = create<DmState>((set) => ({
  threads: [],
  messages: {},
  activePeer: null,
  hasMoreHistory: {},

  setThreads: (threads) => set({ threads }),

  setActivePeer: (peer) =>
    set((state) => {
      if (!peer) return { activePeer: null };
      // Also clear unread for this peer
      const updatedThreads = state.threads.map((t) =>
        t.peerId === peer.peerId ? { ...t, unreadCount: 0 } : t,
      );
      return { activePeer: peer, threads: updatedThreads };
    }),

  addMessage: (msg, myUserId) =>
    set((state) => {
      const isOutgoing = msg.fromUserId === myUserId;
      const peerId = isOutgoing ? msg.toUserId : msg.fromUserId;
      const peerName = isOutgoing
        ? state.activePeer?.peerId === peerId
          ? state.activePeer.peerName
          : peerId
        : msg.fromName;
      const peerColor = isOutgoing
        ? state.activePeer?.peerId === peerId
          ? state.activePeer.peerColor
          : '#6366f1'
        : msg.fromColor;

      // Update message list
      const existing = state.messages[peerId] ?? [];
      const alreadyExists = existing.some((m) => m.id === msg.id);
      const updatedMessages = alreadyExists ? existing : [...existing, msg];

      // Update threads list
      const isCurrentlyActive = state.activePeer?.peerId === peerId;
      const existingThreadIdx = state.threads.findIndex((t) => t.peerId === peerId);
      const newUnread = !isOutgoing && !isCurrentlyActive ? 1 : 0;

      let updatedThreads: DmThread[];
      if (existingThreadIdx !== -1) {
        const currentThread = state.threads[existingThreadIdx]!;
        const updatedThread: DmThread = {
          ...currentThread,
          peerName: peerName || currentThread.peerName,
          peerColor: peerColor || currentThread.peerColor,
          lastMessageAt: msg.createdAt,
          lastMessagePreview: msg.content.slice(0, 80),
          unreadCount: isCurrentlyActive ? 0 : currentThread.unreadCount + newUnread,
        };
        const rest = state.threads.filter((_, i) => i !== existingThreadIdx);
        updatedThreads = [updatedThread, ...rest];
      } else {
        const newThread: DmThread = {
          peerId,
          peerName,
          peerColor,
          lastMessageAt: msg.createdAt,
          lastMessagePreview: msg.content.slice(0, 80),
          unreadCount: isCurrentlyActive ? 0 : newUnread,
        };
        updatedThreads = [newThread, ...state.threads];
      }

      // Audio notification if incoming
      if (!isOutgoing && !isCurrentlyActive) {
        soundService.playNotification();
        void window.echoApi?.showNotification({
          title: `DM: ${peerName}`,
          body: msg.content,
        });
      }

      return {
        messages: {
          ...state.messages,
          [peerId]: updatedMessages,
        },
        threads: updatedThreads,
      };
    }),

  setMessages: (peerId, msgs) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [peerId]: msgs,
      },
    })),

  prependMessages: (peerId, msgs) =>
    set((state) => {
      const existing = state.messages[peerId] ?? [];
      const newIds = new Set(msgs.map((m) => m.id));
      const filteredExisting = existing.filter((m) => !newIds.has(m.id));
      return {
        messages: {
          ...state.messages,
          [peerId]: [...msgs, ...filteredExisting],
        },
      };
    }),

  markThreadRead: (peerId) =>
    set((state) => ({
      threads: state.threads.map((t) => (t.peerId === peerId ? { ...t, unreadCount: 0 } : t)),
    })),

  clearUnread: (peerId) =>
    set((state) => ({
      threads: state.threads.map((t) => (t.peerId === peerId ? { ...t, unreadCount: 0 } : t)),
    })),
}));
