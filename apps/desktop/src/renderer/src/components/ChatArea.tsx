import React, { useState, useEffect, useRef } from 'react';
import { Hash, Send, CornerUpLeft, X } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { wsService } from '../services/websocket';
import { ChatMessageItem } from './ChatMessageItem';

export const ChatArea: React.FC = () => {
  const { identity } = useAuthStore();
  const {
    channels,
    activeChannelId,
    messages,
    typingUsers,
    connectionStatus,
    members,
    replyingTo,
    setReplyingTo,
  } = useChatStore();

  const [inputContent, setInputContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const currentMessages = activeChannelId ? (messages[activeChannelId] ?? []) : [];
  const currentTyping = activeChannelId ? (typingUsers[activeChannelId] ?? []) : [];
  const myMember = members.find((m) => m.userId === identity?.userId);

  // Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChannelId || !inputContent.trim()) return;

    const content = inputContent;
    const replyId = replyingTo?.id;
    setInputContent('');
    setReplyingTo(null);
    wsService.sendMessage(activeChannelId, content, replyId);

    // Immediately clear current user's name from typing state
    if (identity?.displayName) {
      useChatStore.setState((state) => {
        const current = state.typingUsers[activeChannelId] ?? [];
        return {
          typingUsers: {
            ...state.typingUsers,
            [activeChannelId]: current.filter((n) => n !== identity.displayName),
          },
        };
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputContent(e.target.value);
    if (activeChannelId) {
      wsService.sendTyping(activeChannelId);
    }
  };

  if (!activeChannel) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-900 text-slate-500">
        <div className="text-center">
          <Hash className="mx-auto h-12 w-12 opacity-40 mb-2" />
          <p className="text-sm">Bir kanal seçin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full bg-slate-900 relative">
      {/* Top Indeterminate Progress Line when connecting */}
      {connectionStatus === 'connecting' && (
        <div className="h-0.5 w-full bg-slate-800/80 overflow-hidden absolute top-0 left-0 right-0 z-10">
          <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full animate-indeterminate" />
        </div>
      )}

      {/* Top Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-4 shadow-sm select-none">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-slate-400" />
          <span className="font-bold text-white text-sm">{activeChannel.name}</span>
        </div>

        {/* Polished Connection Status Indicator */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-400 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-[11px] tracking-wide">Bağlı</span>
              {/* Signal Bars */}
              <div className="flex items-end gap-0.5 ml-0.5 h-3" title="Sinyal Gücü: Mükemmel">
                <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full" />
                <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full" />
                <span className="w-0.5 h-3.5 bg-emerald-400 rounded-full" />
              </div>
            </div>
          )}
          {connectionStatus === 'connecting' && (
            <div className="flex items-center gap-2 rounded-full bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 text-xs text-amber-400 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-semibold text-[11px] tracking-wide">Bağlanıyor...</span>
            </div>
          )}
          {connectionStatus === 'disconnected' && (
            <div className="flex items-center gap-2 rounded-full bg-rose-950/60 border border-rose-500/30 px-2.5 py-1 text-xs text-rose-400 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="font-semibold text-[11px] tracking-wide">Çevrimdışı</span>
            </div>
          )}
        </div>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <div className="text-center">
              <h3 className="text-base font-bold text-white mb-1">
                #{activeChannel.name} kanalına hoş geldiniz!
              </h3>
              <p className="text-xs">Bu kanalda henüz mesaj bulunmuyor. İlk mesajı siz yazın!</p>
            </div>
          </div>
        ) : (
          currentMessages.map((msg) => {
            const member = members.find((m) => m.userId === msg.authorId);
            return (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                channelId={activeChannel.id}
                member={member}
                currentUserRole={myMember?.role ?? 'member'}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      <div className="h-5 px-4 text-[11px] text-slate-400 italic flex items-center">
        {currentTyping.length > 0 && (
          <div className="flex items-center gap-1.5 text-indigo-400/90 not-italic">
            <span className="flex gap-0.5 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" />
            </span>
            <span className="text-[11px] font-medium text-slate-300">
              {currentTyping.join(', ')} {currentTyping.length === 1 ? 'yazıyor...' : 'yazıyorlar...'}
            </span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 pt-1">
        {/* Reply Preview Bar */}
        {replyingTo && (
          <div className="flex items-center justify-between rounded-t-lg border-t border-x border-slate-800 bg-slate-950/90 px-4 py-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 truncate">
              <CornerUpLeft className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
              <span>
                <strong className="text-white">@{replyingTo.authorName}</strong> kullanıcısına yanıt veriliyor:
              </span>
              <span className="truncate italic text-slate-400 max-w-sm">
                "{replyingTo.content}"
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="ml-2 rounded p-1 text-slate-400 hover:text-white transition"
              title="Yanıtı İptal Et"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="relative flex items-center">
          <input
            type="text"
            value={inputContent}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`#${activeChannel.name} kanalına mesaj gönder`}
            className={`w-full border border-slate-800 bg-slate-950 px-4 py-3 pr-12 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none shadow-inner ${
              replyingTo ? 'rounded-b-lg border-t-0' : 'rounded-lg'
            }`}
          />
          <button
            type="submit"
            disabled={!inputContent.trim() || connectionStatus !== 'connected'}
            className="absolute right-2.5 rounded-md p-1.5 text-indigo-400 transition hover:bg-slate-800 hover:text-indigo-300 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
