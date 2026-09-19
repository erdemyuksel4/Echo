import { z } from 'zod';
import { AuthPayloadSchema } from './auth';
import { GroupSnapshotSchema, ChannelSchema, GroupMemberSchema } from './group';
import { MessageSchema } from './message';

// Standard Envelope
export const WsEnvelopeSchema = z.object({
  v: z.literal(1),
  t: z.string(),
  id: z.string().optional(), // Client nonce
  d: z.unknown(), // Event data payload
});

export type WsEnvelope<T = unknown> = {
  v: 1;
  t: string;
  id?: string;
  d: T;
};

// Client to Server Events
export const WsClientEvents = {
  AUTH: 'auth',
  MSG_SEND: 'msg.send',
  MSG_EDIT: 'msg.edit',
  MSG_DELETE: 'msg.delete',
  REACT_ADD: 'react.add',
  REACT_REMOVE: 'react.remove',
  TYPING: 'typing',
  READ_MARK: 'read.mark',
  CHANNEL_CREATE: 'channel.create',
  CHANNEL_RENAME: 'channel.rename',
  CHANNEL_DELETE: 'channel.delete',
  INVITE_CREATE: 'invite.create',
  HISTORY_FETCH: 'history.fetch',
  PRESENCE_UPDATE: 'presence.update',
  VOICE_JOIN: 'voice.join',
  VOICE_LEAVE: 'voice.leave',
  VOICE_SIGNAL: 'voice.signal',
  VOICE_STATE: 'voice.state',
} as const;

// Server to Client Events
export const WsServerEvents = {
  AUTH_OK: 'auth.ok',
  ERROR: 'error',
  RATE_LIMITED: 'rate.limited',
  SNAPSHOT: 'snapshot',
  MSG_NEW: 'msg.new',
  MSG_UPDATED: 'msg.updated',
  MSG_DELETED: 'msg.deleted',
  REACT_UPDATED: 'react.updated',
  TYPING_USER: 'typing.user',
  CHANNEL_CREATED: 'channel.created',
  CHANNEL_UPDATED: 'channel.updated',
  CHANNEL_DELETED: 'channel.deleted',
  MEMBER_JOINED: 'member.joined',
  MEMBER_UPDATED: 'member.updated',
  PRESENCE_CHANGED: 'presence.changed',
  INVITE_CREATED: 'invite.created',
  HISTORY_DATA: 'history.data',
  VOICE_USER_JOINED: 'voice.user_joined',
  VOICE_USER_LEFT: 'voice.user_left',
  VOICE_SIGNAL: 'voice.signal',
  VOICE_STATE: 'voice.state',
  VOICE_PARTICIPANTS: 'voice.participants',
} as const;

// Event Payload Schemas
export const ClientMsgSendPayloadSchema = z.object({
  channelId: z.string(),
  content: z.string().min(1).max(4000),
  replyTo: z.string().nullable().optional(),
});

export const ClientMsgEditPayloadSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
  content: z.string().min(1).max(4000),
});

export const ClientMsgDeletePayloadSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
});

export const ClientReactAddPayloadSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
  emoji: z.string().min(1).max(32),
});

export const ClientReactRemovePayloadSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
  emoji: z.string().min(1).max(32),
});

export const ServerReactUpdatedPayloadSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
  emoji: z.string(),
  reactions: z.record(z.string(), z.array(z.string())),
});

export const ServerMsgUpdatedPayloadSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
  content: z.string(),
  editedAt: z.number(),
});

export const ServerMsgDeletedPayloadSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
});

export const ClientTypingPayloadSchema = z.object({
  channelId: z.string(),
});

export const ClientChannelCreatePayloadSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  type: z.enum(['text', 'voice']),
});

export const ClientChannelRenamePayloadSchema = z.object({
  channelId: z.string(),
  name: z.string().min(1).max(50).trim(),
});

export const ClientChannelDeletePayloadSchema = z.object({
  channelId: z.string(),
});

export const ClientHistoryFetchPayloadSchema = z.object({
  channelId: z.string(),
  before: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const ServerErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const ServerRateLimitedPayloadSchema = z.object({
  retryAfterMs: z.number(),
});

export const ServerTypingPayloadSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  displayName: z.string(),
});

export const ServerPresencePayloadSchema = z.object({
  userId: z.string(),
  status: z.enum(['online', 'idle', 'offline']),
});

export { AuthPayloadSchema, GroupSnapshotSchema, ChannelSchema, GroupMemberSchema, MessageSchema };
