import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Hash, Send, CornerUpLeft, X, Image, Paperclip } from 'lucide-react';
import type { Attachment, GiphyItem } from '@echo/shared';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { wsService } from '../services/websocket';
import { ChatMessageItem } from './ChatMessageItem';
import { GiphyPicker } from './GiphyPicker';
import { uploadImageAttachment } from '../services/imageCompression';
import { p2pFileTransferService } from '../services/p2pFileTransfer';

export const ChatArea: React.FC = () => {
  const { identity } = useAuthStore();
  const {
    channels,
    activeChannelId,
    activeGroupId,
    messages,
    typingUsers,
    connectionStatus,
    members,
    replyingTo,
    setReplyingTo,
  } = useChatStore();

  const [inputContent, setInputContent] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState<Attachment[]>([]);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const currentMessages = activeChannelId ? (messages[activeChannelId] ?? []) : [];
  const currentTyping = activeChannelId ? (typingUsers[activeChannelId] ?? []) : [];
  const myMember = members.find((m) => m.userId === identity?.userId);

  // Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  const handleUploadImage = useCallback(
    async (file: File) => {
      if (!activeGroupId) return;
      setIsUploading(true);
      try {
        const attachment = await uploadImageAttachment(activeGroupId, file);
        setStagedAttachments((prev) => [...prev, attachment]);
      } catch (err) {
        console.error('Image upload failed:', err);
        alert(`Görsel yüklenemedi: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
      } finally {
        setIsUploading(false);
      }
    },
    [activeGroupId],
  );

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      const attachment = await p2pFileTransferService.registerFileForSharing(file);
      setStagedAttachments((prev) => [...prev, attachment]);
    } catch (err) {
      console.error('P2P file register failed:', err);
    }
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        if (file.type.startsWith('image/')) {
          await handleUploadImage(file);
        } else {
          await handleUploadFile(file);
        }
      }
    },
    [handleUploadImage, handleUploadFile],
  );

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  // Clipboard paste (screenshots)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!activeChannelId) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItems = Array.from(items).filter((item) => item.type.startsWith('image/'));
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          await handleUploadImage(file);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeChannelId, handleUploadImage]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChannelId) return;
    if (!inputContent.trim() && stagedAttachments.length === 0) return;

    const content = inputContent;
    const replyId = replyingTo?.id;
    const attachments = [...stagedAttachments];

    setInputContent('');
    setStagedAttachments([]);
    setReplyingTo(null);

    wsService.sendMessage(activeChannelId, content, replyId, attachments);

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

  const handleGifSelect = (gif: GiphyItem) => {
    const gifAttachment: Attachment = {
      id: `gif-${gif.id}`,
      name: gif.title || 'GIF',
      size: 0,
      mimeType: 'image/gif',
      url: gif.url,
      type: 'gif',
      width: gif.width,
      height: gif.height,
    };
    setStagedAttachments((prev) => [...prev, gifAttachment]);
    setShowGiphyPicker(false);
  };

  const removeStagedAttachment = (id: string) => {
    setStagedAttachments((prev) => prev.filter((a) => a.id !== id));
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
    <div
      className="flex flex-1 flex-col h-full bg-slate-900 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950/80 border-4 border-dashed border-indigo-400 rounded-xl m-2 pointer-events-none">
          <Image className="h-14 w-14 text-indigo-300 mb-3 opacity-90" />
          <p className="text-lg font-bold text-white">Dosyayı buraya bırak</p>
          <p className="text-sm text-indigo-300 mt-1">Görsel veya dosya yüklemek için</p>
        </div>
      )}

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

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-400 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-[11px] tracking-wide">Bağlı</span>
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
          <div className="flex h-full flex-col justify-end p-6 pb-8 select-none">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700/60 text-white mb-4 shadow-lg shadow-slate-950/40">
              <Hash className="h-9 w-9 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">
              #{activeChannel.name} kanalına hoş geldin!
            </h2>
            <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
              Burası <span className="font-semibold text-slate-200">#{activeChannel.name}</span> kanalının başlangıcı. Arkadaşlarınla sohbet etmeye başlamak için ilk mesajı gönder veya görsel paylaş!
            </p>
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
      <div className="p-4 pt-1 relative">
        {/* GIF Picker */}
        {showGiphyPicker && (
          <GiphyPicker onSelect={handleGifSelect} onClose={() => setShowGiphyPicker(false)} />
        )}

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

        {/* Staged Attachment Tray */}
        {stagedAttachments.length > 0 && (
          <div
            className={`flex flex-wrap gap-2 rounded-t-lg border-t border-x border-slate-800 bg-slate-950/80 px-3 py-2 ${replyingTo ? '' : ''}`}
          >
            {stagedAttachments.map((att) => (
              <div key={att.id} className="relative group flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5">
                {att.type === 'image' || att.type === 'gif' ? (
                  <img
                    src={att.url.startsWith('/') ? `http://localhost:8787${att.url}` : att.url}
                    alt={att.name}
                    className="h-10 w-10 object-cover rounded"
                  />
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center rounded bg-indigo-600/20 border border-indigo-500/30">
                    <Paperclip className="h-5 w-5 text-indigo-400" />
                  </div>
                )}
                <span className="text-[10px] text-slate-300 max-w-[80px] truncate">{att.name}</span>
                <button
                  onClick={() => removeStagedAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Row */}
        <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              if (e.target.files) {
                await handleFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          {/* Image button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || connectionStatus !== 'connected'}
            className="flex-shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition disabled:opacity-40"
            title="Görsel Yükle"
          >
            {isUploading ? (
              <svg className="h-4 w-4 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Image className="h-4 w-4" />
            )}
          </button>

          {/* GIF button */}
          <button
            type="button"
            onClick={() => setShowGiphyPicker(!showGiphyPicker)}
            disabled={connectionStatus !== 'connected'}
            className={`flex-shrink-0 rounded-md px-2 py-1 text-xs font-bold transition disabled:opacity-40 ${
              showGiphyPicker
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400'
            }`}
            title="GIF Seç"
          >
            GIF
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputContent}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                stagedAttachments.length > 0
                  ? 'Mesaj ekle (isteğe bağlı)...'
                  : `#${activeChannel.name} kanalına mesaj gönder`
              }
              className={`w-full border border-slate-800 bg-slate-950 px-4 py-3 pr-10 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none shadow-inner ${
                replyingTo || stagedAttachments.length > 0 ? 'rounded-b-lg border-t-0' : 'rounded-lg'
              }`}
            />
            <button
              type="submit"
              disabled={
                (!inputContent.trim() && stagedAttachments.length === 0) ||
                connectionStatus !== 'connected'
              }
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-indigo-400 transition hover:bg-slate-800 hover:text-indigo-300 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
