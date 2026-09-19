import React, { useState, useEffect, useRef } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import { parseMarkdownTokens, type MarkdownToken } from '@echo/shared';
import { useDmStore, type ActivePeer } from '../stores/useDmStore';
import { useAuthStore } from '../stores/useAuthStore';
import { dmWebSocketService } from '../services/dmWebsocket';

interface DmChatAreaProps {
  peer: ActivePeer;
}

export const DmChatArea: React.FC<DmChatAreaProps> = ({ peer }) => {
  const { identity } = useAuthStore();
  const { messages } = useDmStore();
  const [content, setContent] = useState('');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const peerMessages = messages[peer.peerId] ?? [];

  // Fetch history on peer change
  useEffect(() => {
    dmWebSocketService.fetchHistory(peer.peerId);
  }, [peer.peerId]);

  // Mark read
  useEffect(() => {
    if (peerMessages.length > 0) {
      const lastMsg = peerMessages[peerMessages.length - 1]!;
      dmWebSocketService.markRead(peer.peerId, lastMsg.id);
    }
  }, [peer.peerId, peerMessages.length]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [peerMessages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim()) return;

    dmWebSocketService.sendDm(peer.peerId, content.trim());
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderContentTokens = (text: string) => {
    const tokens = parseMarkdownTokens(text);
    return tokens.map((token: MarkdownToken, idx: number) => {
      switch (token.type) {
        case 'text':
          return <span key={idx}>{token.content}</span>;
        case 'bold':
          return <strong key={idx} className="font-bold text-white">{token.content}</strong>;
        case 'italic':
          return <em key={idx} className="italic text-slate-200">{token.content}</em>;
        case 'strike':
          return <del key={idx} className="line-through text-slate-400">{token.content}</del>;
        case 'code':
          return (
            <code key={idx} className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-indigo-300 border border-slate-800">
              {token.content}
            </code>
          );
        case 'codeblock':
          return (
            <pre key={idx} className="my-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 shadow-inner">
              <code>{token.content}</code>
            </pre>
          );
        case 'spoiler': {
          const isRevealed = Boolean(revealedSpoilers[idx]);
          return (
            <span
              key={idx}
              onClick={() => setRevealedSpoilers((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              className={`cursor-pointer rounded px-1.5 py-0.5 transition ${
                isRevealed ? 'bg-slate-800 text-slate-200' : 'bg-slate-700 text-transparent hover:bg-slate-600 select-none'
              }`}
            >
              {token.content}
            </span>
          );
        }
        case 'mention':
          return (
            <span
              key={idx}
              className="rounded px-1.5 py-0.5 font-semibold text-xs bg-slate-800 text-indigo-400"
            >
              @{token.target}
            </span>
          );
        case 'link':
          return (
            <a
              key={idx}
              href={token.url}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 underline hover:text-indigo-300 transition break-all"
            >
              {token.text}
            </a>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-4 shadow-sm select-none">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white text-sm shadow-md"
            style={{ backgroundColor: peer.peerColor || '#6366f1' }}
          >
            {peer.peerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-white text-sm">{peer.peerName}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Direkt Mesajlaşma</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span className="text-[11px]">Uçtan Uca Doğrulanmış</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {peerMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white mb-3 shadow-lg"
              style={{ backgroundColor: peer.peerColor || '#6366f1' }}
            >
              {peer.peerName.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {peer.peerName} ile konuşmanın başlangıcı
            </h3>
            <p className="text-xs max-w-xs text-slate-400">
              Bu kullanıcıyla paylaşılan ortak grubunuz bulunuyor. İlk mesajı siz gönderin!
            </p>
          </div>
        ) : (
          peerMessages.map((msg) => {
            const isMe = msg.fromUserId === identity?.userId;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex gap-3 text-left ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg font-bold text-white text-xs select-none shadow"
                  style={{ backgroundColor: msg.fromColor || '#6366f1' }}
                >
                  {msg.fromName.charAt(0).toUpperCase()}
                </div>

                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="font-semibold text-xs text-white">
                      {isMe ? 'Sen' : msg.fromName}
                    </span>
                    <span className="text-[10px] text-slate-500">{timeStr}</span>
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-2.5 text-xs text-slate-200 break-words leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-800 border border-slate-700/60 rounded-tl-none'
                    }`}
                  >
                    {renderContentTokens(msg.content)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 pt-1">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`@${peer.peerName} kullanıcısına mesaj gönder...`}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 pr-10 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none shadow-inner"
          />
          <button
            type="submit"
            disabled={!content.trim()}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-indigo-400 transition hover:bg-slate-800 hover:text-indigo-300 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
