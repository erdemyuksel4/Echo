import type { Channel, GroupMember, Message, GroupMeta } from '@echo/shared';
export interface GroupItem {
    id: string;
    name: string;
    ownerId?: string;
}
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
    messages: Record<string, Message[]>;
    typingUsers: Record<string, string[]>;
    connectionStatus: 'disconnected' | 'connecting' | 'connected';
    defaultInviteCode: string | null;
    replyingTo: Message | null;
    editingMessageId: string | null;
    unreadCounts: Record<string, number>;
    setGroups: (groups: GroupItem[]) => void;
    addGroup: (group: GroupItem) => void;
    setActiveGroup: (groupId: string | null) => void;
    setSnapshot: (meta: GroupMeta, channels: Channel[], members: GroupMember[], inviteCode?: string) => void;
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
    removeGroup: (groupId: string) => void;
    addMember: (member: GroupMember) => void;
    removeMember: (userId: string) => void;
    setMemberPresence: (userId: string, status: 'online' | 'idle' | 'offline') => void;
    setTypingUser: (channelId: string, displayName: string) => void;
    setDefaultInviteCode: (code: string | null) => void;
}
export declare const useChatStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ChatState>>;
export {};
