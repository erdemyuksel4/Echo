import { create } from 'zustand';
import type { Channel, GroupMember, Message, GroupMeta } from '@echo/shared';

export interface GroupItem {
  id: string;
  name: string;
}

interface ChatState {
  groups: GroupItem[];
  activeGroupId: string | null;
  activeGroupMeta: GroupMeta | null;
  channels: Channel[];
  activeChannelId: string | null;
  members: GroupMember[];
  messages: Record<string, Message[]>; // channelId -> Message[]
  typingUsers: Record<string, string[]>; // channelId -> array of displayNames
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  defaultInviteCode: string | null;

  setGroups: (groups: GroupItem[]) => void;
  addGroup: (group: GroupItem) => void;
  setActiveGroup: (groupId: string | null) => void;
  setSnapshot: (meta: GroupMeta, channels: Channel[], members: GroupMember[]) => void;
  setActiveChannel: (channelId: string | null) => void;
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  addMessage: (channelId: string, message: Message) => void;
  setHistory: (channelId: string, messages: Message[]) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
  updateChannel: (channelId: string, name: string) => void;
  setMemberPresence: (userId: string, status: 'online' | 'idle' | 'offline') => void;
  setTypingUser: (channelId: string, displayName: string) => void;
  setDefaultInviteCode: (code: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  groups: [],
  activeGroupId: null,
  activeGroupMeta: null,
  channels: [],
  activeChannelId: null,
  members: [],
  messages: {},
  typingUsers: {},
  connectionStatus: 'disconnected',
  defaultInviteCode: null,

  setGroups: (groups) => set({ groups }),
  addGroup: (group) =>
    set((state) => ({
      groups: state.groups.some((g) => g.id === group.id) ? state.groups : [...state.groups, group],
    })),
  setActiveGroup: (activeGroupId) => set({ activeGroupId }),

  setSnapshot: (activeGroupMeta, channels, members) => {
    set((state) => {
      // Pick first text channel if none active or current is invalid
      const currentValid = channels.some((c) => c.id === state.activeChannelId);
      const firstText = channels.find((c) => c.type === 'text');
      const activeChannelId = currentValid ? state.activeChannelId : (firstText?.id ?? null);
      return {
        activeGroupMeta,
        channels,
        members,
        activeChannelId,
      };
    });
  },

  setActiveChannel: (activeChannelId) => set({ activeChannelId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  addMessage: (channelId, message) =>
    set((state) => {
      const list = state.messages[channelId] ?? [];
      if (list.some((m) => m.id === message.id)) return state;
      const currentTyping = state.typingUsers[channelId] ?? [];
      const updatedTyping = currentTyping.filter((name) => name !== message.authorName);
      return {
        messages: {
          ...state.messages,
          [channelId]: [...list, message],
        },
        typingUsers: {
          ...state.typingUsers,
          [channelId]: updatedTyping,
        },
      };
    }),

  setHistory: (channelId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: messages,
      },
    })),

  addChannel: (channel) =>
    set((state) => ({
      channels: state.channels.some((c) => c.id === channel.id)
        ? state.channels
        : [...state.channels, channel],
    })),

  removeChannel: (channelId) =>
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
      activeChannelId: state.activeChannelId === channelId ? null : state.activeChannelId,
    })),

  updateChannel: (channelId, name) =>
    set((state) => ({
      channels: state.channels.map((c) => (c.id === channelId ? { ...c, name } : c)),
    })),

  setMemberPresence: (userId, status) =>
    set((state) => ({
      members: state.members.map((m) => (m.userId === userId ? { ...m, status } : m)),
    })),

  setTypingUser: (channelId, displayName) => {
    set((state) => {
      const current = state.typingUsers[channelId] ?? [];
      if (current.includes(displayName)) return state;
      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: [...current, displayName],
        },
      };
    });

    // Auto remove after 3.5 seconds
    setTimeout(() => {
      set((state) => {
        const current = state.typingUsers[channelId] ?? [];
        return {
          typingUsers: {
            ...state.typingUsers,
            [channelId]: current.filter((n) => n !== displayName),
          },
        };
      });
    }, 3500);
  },

  setDefaultInviteCode: (defaultInviteCode) => set({ defaultInviteCode }),
}));
