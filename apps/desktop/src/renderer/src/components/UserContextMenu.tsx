import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Volume1,
  MessageSquare,
  AtSign,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useDmStore } from '../stores/useDmStore';
import { webrtcService } from '../services/webrtc';
import { wsService } from '../services/websocket';

export interface ContextMenuUser {
  userId: string;
  displayName: string;
  avatarColor?: string;
  role?: string;
  isLocal?: boolean;
}

interface Props {
  user: ContextMenuUser;
  position: { x: number; y: number };
  onClose: () => void;
}

export const UserContextMenu: React.FC<Props> = ({ user, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [adjustedPos, setAdjustedPos] = useState(position);

  const { identity } = useAuthStore();
  const { peerVolumes, peerMuted } = useVoiceStore();

  const isLocal = user.userId === identity?.userId;
  const currentVolume = peerVolumes[user.userId] ?? 1.0;
  const isMuted = Boolean(peerMuted[user.userId]);
  const volumePercent = Math.round(currentVolume * 100);

  // Auto-adjust positioning to guarantee the menu stays within screen bounds
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 12;

    let x = position.x;
    let y = position.y;

    if (x + rect.width > window.innerWidth - margin) {
      x = window.innerWidth - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = window.innerHeight - rect.height - margin;
    }
    if (x < margin) x = margin;
    if (y < margin) y = margin;

    setAdjustedPos({ x, y });
  }, [position]);

  // Close menu on click outside or Escape key
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleVolumeChange = (newPercent: number) => {
    const vol = newPercent / 100;
    webrtcService.setPeerVolume(user.userId, vol);
  };

  const handleToggleMute = () => {
    webrtcService.setPeerMuted(user.userId, !isMuted);
  };

  const handleOpenDm = () => {
    useDmStore.getState().setActivePeer({
      peerId: user.userId,
      peerName: user.displayName,
      peerColor: user.avatarColor || '#6366f1',
    });
    useChatStore.getState().setActiveGroup(null);
    useChatStore.getState().setActiveChannel(null);
    useChatStore.setState({ activeGroupMeta: null });
    wsService.disconnect();
    onClose();
  };

  const handleMention = () => {
    const chatInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'textarea[data-chat-input], input[data-chat-input]',
    );
    if (chatInput) {
      const mentionText = `@${user.displayName} `;
      chatInput.value += mentionText;
      chatInput.focus();
    } else {
      void navigator.clipboard.writeText(`@${user.displayName}`);
    }
    onClose();
  };

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(user.userId);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 800);
  };

  const avatarColor = user.avatarColor || '#6366f1';

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedPos.x}px`, top: `${adjustedPos.y}px` }}
      className="fixed z-50 w-64 select-none rounded-2xl border border-slate-800/90 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
    >
      {/* User Header Profile */}
      <div className="flex items-center gap-2.5 rounded-xl bg-slate-900/60 p-2.5 mb-1.5 border border-slate-800/60">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white shadow-md ring-1 ring-white/10"
          style={{ backgroundColor: avatarColor }}
        >
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-white flex items-center gap-1.5">
            <span>{user.displayName}</span>
            {isLocal && (
              <span className="rounded bg-indigo-500/20 px-1 py-0.2 text-[9px] font-bold text-indigo-300 border border-indigo-500/30">
                Sen
              </span>
            )}
          </div>
          <div className="truncate text-[10px] font-mono text-slate-400" title={user.userId}>
            ID: {user.userId.substring(0, 10)}...
          </div>
        </div>
      </div>

      {/* Individual Volume Control for Remote Peers */}
      {!isLocal && (
        <div className="p-2 space-y-2 rounded-xl bg-slate-900/40 border border-slate-800/40 mb-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5 text-rose-400" />
              ) : currentVolume > 1.0 ? (
                <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
              ) : currentVolume > 0 ? (
                <Volume1 className="h-3.5 w-3.5 text-slate-300" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>Kullanıcı Sesi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : currentVolume > 1.0
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-slate-800 text-slate-300'
                }`}
              >
                {isMuted ? 'SUSTURULDU' : `%${volumePercent}`}
              </span>
              {currentVolume !== 1.0 && (
                <button
                  type="button"
                  onClick={() => handleVolumeChange(100)}
                  className="rounded p-0.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Varsayılan Sese Sıfırla (%100)"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Volume Slider (0% to 200%) */}
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={isMuted ? 0 : volumePercent}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              disabled={isMuted}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-indigo-500 focus:outline-none ${
                isMuted ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            />
          </div>

          {/* Mute For Me Checkbox Button */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition border ${
              isMuted
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <VolumeX className={`h-3.5 w-3.5 ${isMuted ? 'text-rose-400' : 'text-slate-400'}`} />
              <span>Kullanıcıyı Sustur</span>
            </div>
            <div
              className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                isMuted ? 'bg-rose-500 border-rose-400 text-white' : 'border-slate-700 bg-slate-800'
              }`}
            >
              {isMuted && <Check className="h-3 w-3 stroke-[3]" />}
            </div>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-0.5">
        {!isLocal && (
          <button
            type="button"
            onClick={handleOpenDm}
            className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-indigo-600 hover:text-white transition"
          >
            <MessageSquare className="h-3.5 w-3.5 text-indigo-400 group-hover:text-white" />
            <span>Direkt Mesaj Gönder</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleMention}
          className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          <AtSign className="h-3.5 w-3.5 text-slate-400" />
          <span>Bahset (@{user.displayName})</span>
        </button>

        <div className="h-px bg-slate-800/80 my-1" />

        <button
          type="button"
          onClick={handleCopyId}
          className="w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <div className="flex items-center gap-2.5">
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? 'Kopyalandı!' : 'Kullanıcı ID Kopyala'}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">ID</span>
        </button>
      </div>
    </div>
  );
};
