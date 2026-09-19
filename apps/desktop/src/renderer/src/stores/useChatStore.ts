import { create } from 'zustand';
import type { Channel, GroupMember, Message, GroupMeta } from '@echo/shared';

export interface GroupItem {
  id: string;
  name: string;
}

const loadInitialGroups = (): GroupItem[] => {
  try {
    const raw = localStorage.getItem('echo_groups');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    void e;
  }
  return [];
};

const loadInitialActiveGroupId = (): string | null => {
  try {
    return localStorage.getItem('echo_active_group_id');
  } catch (e) {
    void e;
  }
  return null;
};

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
  replyingTo: Message | null;
  editingMessageId: string | null;
  unreadCounts: Record<string, number>; // channelId -> unread count

  setGroups: (groups: GroupItem[]) => void;
  addGroup: (group: GroupItem) => void;
  setActiveGroup: (groupId: string | null) => void;
  setSnapshot: (
    meta: GroupMeta,
    channels: Channel[],
    members: GroupMember[],
    inviteCode?: string,
  ) => void;
  setActiveChannel: (channelId: string | null) => void;
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  addMessage: (channelId: string, message: Message) => void;
  updateMessage: (channelId: string, messageId: string, content: string, editedAt: number) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  updateReactions: (channelId: string, messageId: string, reactions: Record<string, string[]>) => void;
  setReplyingTo: (message: Message | null) => void;
  setEditingMessageId: (id: string | null) => void;
  markChannelRead: (channelId: string) => void;
  setHistory: (channelId: string, messages: Message[]) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
  updateChannel: (channelId: string, name: string) => void;
  addMember: (member: GroupMember) => void;
  setMemberPresence: (userId: string, status: 'online' | 'idle' | 'offline') => void;
  setTypingUser: (channelId: string, displayName: string) => void;
  setDefaultInviteCode: (code: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  groups: loadInitialGroups(),
  activeGroupId: loadInitialActiveGroupId(),
  activeGroupMeta: null,
  channels: [],
  activeChannelId: null,
  members: [],
  messages: {},
  typingUsers: {},
  connectionStatus: 'disconnected',
  defaultInviteCode: null,
  replyingTo: null,
  editingMessageId: null,
  unreadCounts: {},

  setGroups: (groups) => {
    try {
      localStorage.setItem('echo_groups', JSON.stringify(groups));
    } catch (e) {
      void e;
    }
    set({ groups });
  },

  addGroup: (group) =>
    set((state) => {
      const updated = state.groups.some((g) => g.id === group.id)
        ? state.groups.map((g) => (g.id === group.id ? { id: g.id, name: group.name } : g))
        : [...state.groups, group];
      try {
        localStorage.setItem('echo_groups', JSON.stringify(updated));
      } catch (e) {
        void e;
      }
      return { groups: updated };
    }),

  setActiveGroup: (activeGroupId) => {
    try {
      if (activeGroupId) {
        localStorage.setItem('echo_active_group_id', activeGroupId);
      } else {
        localStorage.removeItem('echo_active_group_id');
      }
    } catch (e) {
      void e;
    }
    set({ activeGroupId });
  },

  setSnapshot: (activeGroupMeta, channels, members, inviteCode) => {
    set((state) => {
      const updatedGroups = state.groups.some((g) => g.id === activeGroupMeta.id)
        ? state.groups.map((g) =>
            g.id === activeGroupMeta.id ? { id: g.id, name: activeGroupMeta.name } : g,
          )
        : [...state.groups, { id: activeGroupMeta.id, name: activeGroupMeta.name }];
      try {
        localStorage.setItem('echo_groups', JSON.stringify(updatedGroups));
      } catch (e) {
        void e;
      }

      // Pick first text channel if none active or current is invalid
      const currentValid = channels.some((c) => c.id === state.activeChannelId);
      const firstText = channels.find((c) => c.type === 'text');
      const activeChannelId = currentValid ? state.activeChannelId : (firstText?.id ?? null);
      return {
        groups: updatedGroups,
        activeGroupMeta,
        channels,
        members,
        activeChannelId,
        defaultInviteCode: inviteCode ?? state.defaultInviteCode,
      };
    });
  },

  addMember: (member) =>
    set((state) => {
      if (state.members.some((m) => m.userId === member.userId)) {
        return state;
      }
      return {
        members: [...state.members, member],
      };
    }),

  setActiveChannel: (activeChannelId) =>
    set((state) => ({
      activeChannelId,
      unreadCounts: activeChannelId
        ? { ...state.unreadCounts, [activeChannelId]: 0 }
        : state.unreadCounts,
      replyingTo: null,
      editingMessageId: null,
    })),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  addMessage: (channelId, message) =>
    set((state) => {
      const list = state.messages[channelId] ?? [];
      if (list.some((m) => m.id === message.id)) return state;
      const currentTyping = state.typingUsers[channelId] ?? [];
      const updatedTyping = currentTyping.filter((name) => name !== message.authorName);
      const isUnread = state.activeChannelId !== channelId;
      const currentUnread = state.unreadCounts[channelId] ?? 0;

      return {
        messages: {
          ...state.messages,
          [channelId]: [...list, message],
        },
        typingUsers: {
          ...state.typingUsers,
          [channelId]: updatedTyping,
        },
        unreadCounts: isUnread
          ? { ...state.unreadCounts, [channelId]: currentUnread + 1 }
          : state.unreadCounts,
      };
    }),

  updateMessage: (channelId, messageId, content, editedAt) =>
    set((state) => {
      const list = state.messages[channelId] ?? [];
      return {
        messages: {
          ...state.messages,
          [channelId]: list.map((m) => (m.id === messageId ? { ...m, content, editedAt } : m)),
        },
      };
    }),

  deleteMessage: (channelId, messageId) =>
    set((state) => {
      const list = state.messages[channelId] ?? [];
      return {
        messages: {
          ...state.messages,
          [channelId]: list.map((m) => (m.id === messageId ? { ...m, deleted: true } : m)),
        },
      };
    }),

  updateReactions: (channelId, messageId, reactions) =>
    set((state) => {
      const list = state.messages[channelId] ?? [];
      return {
        messages: {
          ...state.messages,
          [channelId]: list.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        },
      };
    }),

  setReplyingTo: (replyingTo) => set({ replyingTo }),
  setEditingMessageId: (editingMessageId) => set({ editingMessageId }),
  markChannelRead: (channelId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [channelId]: 0 },
    })),

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
