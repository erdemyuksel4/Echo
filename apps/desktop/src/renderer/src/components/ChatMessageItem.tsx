import React, { useState } from 'react';
import { CornerUpLeft, Pencil, Trash2, Smile } from 'lucide-react';
import {
  type Message,
  type GroupMember,
  parseMarkdownTokens,
  type MarkdownToken,
} from '@echo/shared';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { wsService } from '../services/websocket';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '🚀', '👀'];

interface Props {
  message: Message;
  channelId: string;
  member?: GroupMember;
  currentUserRole?: 'owner' | 'admin' | 'member';
}

export const ChatMessageItem: React.FC<Props> = ({
  message,
  channelId,
  member,
  currentUserRole = 'member',
}) => {
  const { identity } = useAuthStore();
  const { setReplyingTo } = useChatStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});

  const isAuthor = identity?.userId === message.authorId;
  const canDelete = isAuthor || currentUserRole === 'owner' || currentUserRole === 'admin';

  const avatarColor = member?.pubkey ? '#' + member.pubkey.substring(0, 6) : '#6366f1';

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editContent.trim()) return;

    if (editContent.trim() !== message.content) {
      wsService.editMessage(channelId, message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleToggleReaction = (emoji: string) => {
    if (!identity?.userId) return;
    const currentList = message.reactions?.[emoji] ?? [];
    const hasReacted = currentList.includes(identity.userId);

    if (hasReacted) {
      wsService.removeReaction(channelId, message.id, emoji);
    } else {
      wsService.addReaction(channelId, message.id, emoji);
    }
    setShowEmojiPicker(false);
  };

  const toggleSpoiler = (index: number) => {
    setRevealedSpoilers((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const renderContentTokens = (content: string) => {
    const tokens = parseMarkdownTokens(content);

    return tokens.map((token: MarkdownToken, idx: number) => {
      switch (token.type) {
        case 'text':
          return <span key={idx}>{token.content}</span>;
        case 'bold':
          return (
            <strong key={idx} className="font-bold text-white">
              {token.content}
            </strong>
          );
        case 'italic':
          return (
            <em key={idx} className="italic text-slate-200">
              {token.content}
            </em>
          );
        case 'strike':
          return (
            <del key={idx} className="line-through text-slate-400">
              {token.content}
            </del>
          );
        case 'code':
          return (
            <code
              key={idx}
              className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-indigo-300 border border-slate-800"
            >
              {token.content}
            </code>
          );
        case 'codeblock':
          return (
            <pre
              key={idx}
              className="my-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 shadow-inner"
            >
              <code>{token.content}</code>
            </pre>
          );
        case 'spoiler': {
          const isRevealed = Boolean(revealedSpoilers[idx]);
          return (
            <span
              key={idx}
              onClick={() => toggleSpoiler(idx)}
              className={`rounded px-1.5 py-0.5 cursor-pointer text-xs transition-all ${
                isRevealed
                  ? 'bg-slate-800/80 text-slate-200 border border-slate-700/50'
                  : 'bg-slate-800 text-transparent hover:bg-slate-700/80 select-none'
              }`}
              title={isRevealed ? 'Gizlemek için tıkla' : "Spoiler'ı görmek için tıkla"}
            >
              {token.content}
            </span>
          );
        }
        case 'mention': {
          const isMe = identity?.displayName && token.target === identity.displayName;
          const isEveryone = token.target === 'everyone';
          return (
            <span
              key={idx}
              className={`rounded px-1.5 py-0.5 font-semibold text-xs transition ${
                isMe || isEveryone
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-800 text-indigo-400'
              }`}
            >
              @{token.target}
            </span>
          );
        }
        case 'link':
          return (
            <a
              key={idx}
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline hover:text-indigo-300 break-all"
            >
              {token.text}
            </a>
          );
        default:
          return null;
      }
    });
  };

  // If message was deleted
  if (message.deleted) {
    return (
      <div className="flex items-start gap-3 -mx-4 px-4 py-1 rounded opacity-50 select-none">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-500 bg-slate-800">
          ?
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-slate-500">{message.authorName}</span>
            <span className="text-[10px] text-slate-600">{formatTime(message.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 italic">[Bu mesaj silindi]</p>
        </div>
      </div>
    );
  }

  const reactionsList = Object.entries(message.reactions ?? {}).filter(
    ([, userIds]) => userIds.length > 0,
  );

  return (
    <div className="group relative flex items-start gap-3 -mx-4 px-4 py-1.5 rounded transition-colors hover:bg-slate-800/40">
      {/* Action Toolbar on Hover */}
      <div className="absolute right-4 -top-3 z-20 hidden group-hover:flex items-center rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl px-1 py-0.5 gap-0.5 text-slate-400">
        {/* Quick Reaction Button */}
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="rounded p-1 hover:bg-slate-800 hover:text-white transition"
            title="Tepki Ekle"
          >
            <Smile className="h-4 w-4" />
          </button>

          {/* Emoji Popover */}
          {showEmojiPicker && (
            <div className="absolute right-0 top-8 z-30 flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl backdrop-blur-md">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleToggleReaction(emoji)}
                  className="rounded-lg p-1.5 text-base hover:bg-slate-800 hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reply Button */}
        <button
          onClick={() => setReplyingTo(message)}
          className="rounded p-1 hover:bg-slate-800 hover:text-white transition"
          title="Yanıtla"
        >
          <CornerUpLeft className="h-4 w-4" />
        </button>

        {/* Edit Button (Author only) */}
        {isAuthor && (
          <button
            onClick={() => {
              setEditContent(message.content);
              setIsEditing(true);
            }}
            className="rounded p-1 hover:bg-slate-800 hover:text-white transition"
            title="Düzenle"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}

        {/* Delete Button */}
        {canDelete && (
          <button
            onClick={() => wsService.deleteMessage(channelId, message.id)}
            className="rounded p-1 hover:bg-rose-950/60 hover:text-rose-400 transition"
            title="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Author Avatar */}
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow select-none"
        style={{ backgroundColor: avatarColor }}
      >
        {message.authorName.charAt(0).toUpperCase()}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        {/* Reply Reference Header */}
        {message.replyTo && message.replyToAuthorName && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 select-none">
            <CornerUpLeft className="h-3.5 w-3.5 text-indigo-400" />
            <span className="font-semibold text-indigo-300">@{message.replyToAuthorName}</span>
            <span className="truncate max-w-sm text-slate-500 italic">
              {message.replyToContent}
            </span>
          </div>
        )}

        {/* Header (Author, Time, Edited tag) */}
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-white select-none">{message.authorName}</span>
          <span className="text-[10px] text-slate-500 select-none">{formatTime(message.createdAt)}</span>
          {message.editedAt && (
            <span className="text-[10px] text-slate-500 italic select-none" title="Düzenlendi">
              (düzenlendi)
            </span>
          )}
        </div>

        {/* Content or Edit Form */}
        {isEditing ? (
          <div className="mt-1 space-y-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="w-full rounded-lg border border-indigo-500/60 bg-slate-950 p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans shadow-inner"
              autoFocus
            />
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>
                Kaydetmek için <strong className="text-white">Enter</strong>, iptal için{' '}
                <strong className="text-white">Esc</strong>
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded px-2 py-0.5 text-slate-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="rounded bg-indigo-600 px-2 py-0.5 font-medium text-white hover:bg-indigo-500"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-0.5 text-xs text-slate-200 break-words leading-relaxed select-text">
            {renderContentTokens(message.content)}
          </div>
        )}

        {/* Reactions Section */}
        {reactionsList.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 select-none">
            {reactionsList.map(([emoji, userIds]) => {
              const hasReacted = identity?.userId ? userIds.includes(identity.userId) : false;

              return (
                <button
                  key={emoji}
                  onClick={() => handleToggleReaction(emoji)}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition border ${
                    hasReacted
                      ? 'bg-indigo-950/70 border-indigo-500/50 text-indigo-300 shadow-sm'
                      : 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80'
                  }`}
                  title={`${userIds.length} kişi bu tepkiyi verdi`}
                >
                  <span>{emoji}</span>
                  <span className="font-semibold text-[11px]">{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
