import React, { useState, useEffect, useRef } from 'react';
import { Hash, Send } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { wsService } from '../services/websocket';

export const ChatArea: React.FC = () => {
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

    wsService.sendMessage(activeChannelId, inputContent);
    setInputContent('');
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
    <div className="flex flex-1 flex-col h-full bg-slate-900">
      {/* Top Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-4 shadow-sm select-none">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-slate-400" />
          <span className="font-bold text-white text-sm">{activeChannel.name}</span>
        </div>

        {/* Connection Indicator */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {connectionStatus === 'connected' && (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Bağlı
            </span>
          )}
          {connectionStatus === 'connecting' && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Bağlanıyor...
            </span>
          )}
          {connectionStatus === 'disconnected' && (
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Çevrimdışı
            </span>
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
      <div className="h-5 px-4 text-[11px] text-slate-400 italic">
        {currentTyping.length > 0 && (
          <span>
            {currentTyping.join(', ')} {currentTyping.length === 1 ? 'yazıyor...' : 'yazıyorlar...'}
          </span>
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
