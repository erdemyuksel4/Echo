import React, { useState, useEffect, useRef } from 'react';
import { Hash, Send } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { wsService } from '../services/websocket';

export const ChatArea: React.FC = () => {
  const { identity } = useAuthStore();
  const { channels, activeChannelId, messages, typingUsers, connectionStatus, members } =
    useChatStore();

  const [inputContent, setInputContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const currentMessages = activeChannelId ? (messages[activeChannelId] ?? []) : [];
  const currentTyping = activeChannelId ? (typingUsers[activeChannelId] ?? []) : [];

  // Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChannelId || !inputContent.trim()) return;

    const content = inputContent;
    setInputContent('');
    wsService.sendMessage(activeChannelId, content);

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

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            const avatarColor = member?.pubkey ? '#' + member.pubkey.substring(0, 6) : '#6366f1';

            return (
              <div
                key={msg.id}
                className="flex items-start gap-3 group hover:bg-slate-800/30 -mx-4 px-4 py-1 rounded"
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow"
                  style={{ backgroundColor: avatarColor }}
                >
                  {msg.authorName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-white">{msg.authorName}</span>
                    <span className="text-[10px] text-slate-500">{formatTime(msg.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-200 break-words leading-relaxed select-text">
                    {msg.content}
                  </p>
                </div>
              </div>
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
        <form onSubmit={handleSendMessage} className="relative flex items-center">
          <input
            type="text"
            value={inputContent}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`#${activeChannel.name} kanalına mesaj gönder`}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 pr-12 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none shadow-inner"
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
