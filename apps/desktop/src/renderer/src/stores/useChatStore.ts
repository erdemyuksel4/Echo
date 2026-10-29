import { create } from 'zustand';
import type { Channel, GroupMember, Message, GroupMeta, DiscordState, ServerDiscordConfigPayload } from '@echo/shared';

export interface GroupItem {
  id: string;
  name: string;
  ownerId?: string;
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

interface GroupSnapshotCache {
  group: GroupMeta;
  channels: Channel[];
  members: GroupMember[];
  inviteCode?: string;
}

interface ChatState {
  groups: GroupItem[];
  activeGroupId: string | null;
  activeGroupMeta: GroupMeta | null;
  channels: Channel[];
  activeChannelId: string | null;
  members: GroupMember[];
  groupSnapshots: Record<string, GroupSnapshotCache>;
  messages: Record<string, Message[]>; // channelId -> Message[]
  typingUsers: Record<string, string[]>; // channelId -> array of displayNames
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  defaultInviteCode: string | null;
  replyingTo: Message | null;
  editingMessageId: string | null;
  unreadCounts: Record<string, number>; // channelId -> unread count
  discordState: DiscordState | null;
  discordConfig: ServerDiscordConfigPayload | null;
  threadMessages: Record<string, Message[]>; // threadId -> Message[]
  activeThreadMessage: Message | null;
  setActiveThreadMessage: (message: Message | null) => void;
  setThreadHistory: (threadId: string, messages: Message[]) => void;
  addThreadMessage: (threadId: string, message: Message) => void;

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
  updateMessage: (
    channelId: string,
    messageId: string,
    content?: string,
    editedAt?: number | null,
    threadCount?: number,
    threadLastReplyAt?: number | null,
  ) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  updateReactions: (
    channelId: string,
    messageId: string,
    reactions: Record<string, string[]>,
  ) => void;
  setReplyingTo: (message: Message | null) => void;
  setEditingMessageId: (id: string | null) => void;
  markChannelRead: (channelId: string) => void;
  setHistory: (channelId: string, messages: Message[]) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
  updateChannel: (channelId: string, name: string) => void;
  removeGroup: (groupId: string) => void;
  addMember: (member: GroupMember) => void;
  removeMember: (userId: string) => void;
  setMemberPresence: (userId: string, status: 'online' | 'idle' | 'offline') => void;
  setTypingUser: (channelId: string, displayName: string) => void;
  setDefaultInviteCode: (code: string | null) => void;
  setDiscordState: (state: DiscordState | null) => void;
  setDiscordConfig: (config: ServerDiscordConfigPayload | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  groups: loadInitialGroups(),
  activeGroupId: loadInitialActiveGroupId(),
  activeGroupMeta: null,
  channels: [],
  activeChannelId: null,
  members: [],
  groupSnapshots: {},
  messages: {},
  typingUsers: {},
  connectionStatus: 'disconnected',
  defaultInviteCode: null,
  replyingTo: null,
  editingMessageId: null,
  unreadCounts: {},
  discordState: null,
  discordConfig: null,
  threadMessages: {},
  activeThreadMessage: null,

  setActiveThreadMessage: (activeThreadMessage) => set({ activeThreadMessage }),

  setThreadHistory: (threadId, messages) =>
    set((state) => ({
      threadMessages: {
        ...state.threadMessages,
        [threadId]: messages,
      },
    })),

  addThreadMessage: (threadId, message) =>
    set((state) => {
      const list = state.threadMessages[threadId] ?? [];
      if (list.some((m) => m.id === message.id)) return state;
      return {
        threadMessages: {
          ...state.threadMessages,
          [threadId]: [...list, message],
        },
      };
    }),

  setDiscordState: (discordState) => set({ discordState }),
  setDiscordConfig: (discordConfig) => set({ discordConfig }),

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

    set((state) => {
      if (!activeGroupId) {
        return {
          activeGroupId: null,
          activeGroupMeta: null,
          activeChannelId: null,
          channels: [],
          members: [],
          defaultInviteCode: null,
          discordState: null,
          discordConfig: null,
        };
      }

      const cached = state.groupSnapshots[activeGroupId];
      if (cached) {
        const currentValid = cached.channels.some((c) => c.id === state.activeChannelId);
        const firstText = cached.channels.find((c) => c.type === 'text');
        const activeChannelId = currentValid ? state.activeChannelId : (firstText?.id ?? null);

        return {
          activeGroupId,
          activeGroupMeta: cached.group,
          channels: cached.channels,
          members: cached.members,
          activeChannelId,
          defaultInviteCode: cached.inviteCode ?? state.defaultInviteCode,
        };
      }

      const group = state.groups.find((g) => g.id === activeGroupId);
      return {
        activeGroupId,
        activeGroupMeta: group
          ? {
              id: group.id,
              name: group.name,
              ownerId: group.ownerId ?? '',
              createdAt: Date.now(),
            }
          : null,
        channels: [],
        members: [],
        activeChannelId: null,
      };
    });
  },

  setSnapshot: (activeGroupMeta, channels, members, inviteCode) => {
    set((state) => {
      const updatedGroups = state.groups.some((g) => g.id === activeGroupMeta.id)
        ? state.groups.map((g) =>
            g.id === activeGroupMeta.id
              ? { id: g.id, name: activeGroupMeta.name, ownerId: activeGroupMeta.ownerId }
              : g,
          )
        : [
            ...state.groups,
            {
              id: activeGroupMeta.id,
              name: activeGroupMeta.name,
              ownerId: activeGroupMeta.ownerId,
            },
          ];
      try {
        localStorage.setItem('echo_groups', JSON.stringify(updatedGroups));
      } catch (e) {
        void e;
      }

      const updatedSnapshots = {
        ...state.groupSnapshots,
        [activeGroupMeta.id]: {
          group: activeGroupMeta,
          channels,
          members,
          inviteCode,
        },
      };

      // Only update active channel/meta/members if this group is STILL the active group!
      const isActive = state.activeGroupId === activeGroupMeta.id;
      if (!isActive) {
        return {
          groups: updatedGroups,
          groupSnapshots: updatedSnapshots,
        };
      }

      // Pick first text channel if none active or current is invalid
      const currentValid = channels.some((c) => c.id === state.activeChannelId);
      const firstText = channels.find((c) => c.type === 'text');
      const activeChannelId = currentValid ? state.activeChannelId : (firstText?.id ?? null);
      return {
        groups: updatedGroups,
        groupSnapshots: updatedSnapshots,
        activeGroupMeta,
        channels,
        members,
        activeChannelId,
        defaultInviteCode: inviteCode ?? state.defaultInviteCode,
      };
    });
  },

  removeGroup: (groupId) =>
    set((state) => {
      const updated = state.groups.filter((g) => g.id !== groupId);
      try {
        localStorage.setItem('echo_groups', JSON.stringify(updated));
      } catch (e) {
        void e;
      }

      if (state.activeGroupId === groupId) {
        try {
          localStorage.removeItem('echo_active_group_id');
        } catch (e) {
          void e;
        }
        return {
          groups: updated,
          activeGroupId: null,
          activeGroupMeta: null,
          channels: [],
          members: [],
          activeChannelId: null,
          defaultInviteCode: null,
        };
      }

      return { groups: updated };
    }),

  addMember: (member) =>
    set((state) => {
      if (state.members.some((m) => m.userId === member.userId)) {
        return state;
      }
      return {
        members: [...state.members, member],
      };
    }),

  removeMember: (userId) =>
    set((state) => ({
      members: state.members.filter((m) => m.userId !== userId),
    })),

  setActiveChannel: (activeChannelId) =>
    set((state) => ({
      activeChannelId,
      unreadCounts: activeChannelId
        ? { ...state.unreadCounts, [activeChannelId]: 0 }
        : state.unreadCounts,
      replyingTo: null,
      editingMessageId: null,
      activeThreadMessage: null,
    })),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  addMessage: (channelId, message) =>
    set((state) => {
      // If it's a thread message, add to threadMessages instead of main channel messages
      if (message.threadId) {
        const threadList = state.threadMessages[message.threadId] ?? [];
        if (threadList.some((m) => m.id === message.id)) return state;
        return {
          threadMessages: {
            ...state.threadMessages,
            [message.threadId]: [...threadList, message],
          },
        };
      }

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

  updateMessage: (channelId, messageId, content, editedAt, threadCount, threadLastReplyAt) =>
    set((state) => {
      const list = state.messages[channelId] ?? [];
      const updatedMessages = list.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          ...(content !== undefined ? { content } : {}),
          ...(editedAt !== undefined ? { editedAt } : {}),
          ...(threadCount !== undefined ? { threadCount } : {}),
          ...(threadLastReplyAt !== undefined ? { threadLastReplyAt } : {}),
        };
      });

      // Also update inside threadMessages if present
      const updatedThreadMessages = { ...state.threadMessages };
      for (const [tId, tMsgs] of Object.entries(updatedThreadMessages)) {
        if (tMsgs.some((m) => m.id === messageId)) {
          updatedThreadMessages[tId] = tMsgs.map((m) => {
            if (m.id !== messageId) return m;
            return {
              ...m,
              ...(content !== undefined ? { content } : {}),
              ...(editedAt !== undefined ? { editedAt } : {}),
            };
          });
        }
      }

      const updatedActiveThread =
        state.activeThreadMessage?.id === messageId
          ? {
              ...state.activeThreadMessage,
              ...(content !== undefined ? { content } : {}),
              ...(threadCount !== undefined ? { threadCount } : {}),
              ...(threadLastReplyAt !== undefined ? { threadLastReplyAt } : {}),
            }
          : state.activeThreadMessage;

      return {
        messages: {
          ...state.messages,
          [channelId]: updatedMessages,
        },
        threadMessages: updatedThreadMessages,
        activeThreadMessage: updatedActiveThread,
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
      const updatedThreadMessages = { ...state.threadMessages };
      for (const [tId, tMsgs] of Object.entries(updatedThreadMessages)) {
        if (tMsgs.some((m) => m.id === messageId)) {
          updatedThreadMessages[tId] = tMsgs.map((m) => (m.id === messageId ? { ...m, reactions } : m));
        }
      }
      return {
        messages: {
          ...state.messages,
          [channelId]: list.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        },
        threadMessages: updatedThreadMessages,
      };
    }),

  setReplyingTo: (replyingTo) => set({ replyingTo }),
  setEditingMessageId: (editingMessageId) => set({ editingMessageId }),
  markChannelRead: (channelId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [channelId]: 0 },
    })),

  setHistory: (channelId, messages) =>
    set((state) => {
      const existing = state.messages[channelId] ?? [];
      const map = new Map();
      for (const m of existing) map.set(m.id, m);
      for (const m of messages) map.set(m.id, m);
      const merged = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
      return {
        messages: {
          ...state.messages,
          [channelId]: merged,
        },
      };
    }),

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
