import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Smile,
} from 'lucide-react';
import { type Message, type GroupMember } from '@echo/shared';
import { useChatStore } from '../stores/useChatStore';
import { wsService } from '../services/websocket';
import { ChatMessageItem } from './ChatMessageItem';

interface ThreadPanelProps {
  channelId: string;
  rootMessage: Message;
  channelName: string;
  members: GroupMember[];
  currentUserRole?: 'owner' | 'admin' | 'member';
  onClose: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '🚀', '👀'];

export const ThreadPanel: React.FC<ThreadPanelProps> = ({
  channelId,
  rootMessage,
  channelName,
  members,
  currentUserRole = 'member',
  onClose,
}) => {
  const { threadMessages } = useChatStore();
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = threadMessages[rootMessage.id] ?? [];

  // Fetch thread history on mount or rootMessage change
  useEffect(() => {
    wsService.fetchThread(channelId, rootMessage.id);
  }, [channelId, rootMessage.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Auto focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [rootMessage.id]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    wsService.sendMessage(channelId, trimmed, undefined, undefined, rootMessage.id);
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const getMember = (authorId: string) => members.find((m) => m.userId === authorId);

  return (
    <div className="flex h-full w-96 flex-col border-l border-slate-800 bg-slate-900 shadow-2xl z-20 flex-shrink-0 animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="flex h-12 items-center justify-between border-b border-slate-800/80 px-4 bg-slate-900/90 backdrop-blur select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/20 text-indigo-400">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white truncate">Alt Başlık</span>
            <span className="text-[10px] text-slate-400 truncate">#{channelName} kanalında</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          title="Alt Başlığı Kapat (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Root Message Box (Sticky Preview) */}
      <div className="p-3 bg-slate-950/60 border-b border-slate-800/60">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1 select-none">
          <span>Kök Mesaj</span>
        </div>
        <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
          <ChatMessageItem
            message={rootMessage}
            channelId={channelId}
            member={getMember(rootMessage.authorId)}
            currentUserRole={currentUserRole}
            isInThreadPanel={true}
          />
        </div>
      </div>

      {/* Thread Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 select-none">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 mb-3 border border-indigo-500/20">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Henüz yanıt yok</h4>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xs leading-relaxed">
              Bu alt başlıkta ilk mesajı göndererek sohbeti başlatın.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              channelId={channelId}
              member={getMember(msg.authorId)}
              currentUserRole={currentUserRole}
              isInThreadPanel={true}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Thread Input Area */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90 relative">
        {/* Emoji Popover */}
        {showEmojiPicker && (
          <div className="absolute left-3 bottom-14 z-30 flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl backdrop-blur-md">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddEmoji(emoji)}
                className="rounded-lg p-1.5 text-base hover:bg-slate-800 hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Alt mesaja yanıt yaz..."
              maxLength={4000}
              className="w-full rounded-xl bg-slate-800/90 border border-slate-700/80 px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition pr-9"
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-2 text-slate-400 hover:text-white transition p-1 rounded-md"
              title="Emoji Ekle"
            >
              <Smile className="h-4 w-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!content.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition shadow-sm flex-shrink-0"
            title="Gönder (Enter)"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
