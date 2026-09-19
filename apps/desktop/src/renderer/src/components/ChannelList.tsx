import React, { useState } from 'react';
import { Hash, Volume2, Plus, Share2, Check } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { wsService } from '../services/websocket';

export const ChannelList: React.FC = () => {
  const { identity } = useAuthStore();
  const { activeGroupMeta, channels, activeChannelId, setActiveChannel, defaultInviteCode } =
    useChatStore();

  const [copied, setCopied] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  if (!activeGroupMeta) {
    return (
      <div className="flex h-full w-60 flex-col bg-slate-900 border-r border-slate-800/60 select-none">
        {/* DM Header */}
        <div className="flex h-14 items-center border-b border-slate-800/80 px-4 shadow-sm">
          <h1 className="font-bold text-white text-sm">Direkt Mesajlar</h1>
        </div>

        {/* DM Navigation Items */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2">
          <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs font-medium text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Arkadaşlar (Çevrimiçi)</span>
          </div>

          <div className="pt-4 px-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Sohbetler
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Özel mesajlaşmak için bir gruba girip üye listesinden arkadaşlarınızı seçebilirsiniz.
            </p>
          </div>
        </div>

        {/* User Status Bar */}
        <div className="flex h-14 items-center bg-slate-950/80 px-3 border-t border-slate-800/60">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow"
            style={{ backgroundColor: identity?.avatarColor ?? '#4f46e5' }}
          >
            {identity?.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="ml-2.5 flex-1 min-w-0">
            <div className="truncate text-xs font-semibold text-white">
              {identity?.displayName}
            </div>
            <div className="text-[10px] text-emerald-400">Çevrimiçi</div>
          </div>
        </div>
      </div>
    );
  }

  const handleCopyInvite = () => {
    if (defaultInviteCode) {
      navigator.clipboard.writeText(defaultInviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    wsService.createChannel(newChannelName, 'text');
    setNewChannelName('');
    setShowAddChannel(false);
  };

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  return (
    <div className="flex h-full w-60 flex-col bg-slate-900 border-r border-slate-800/60 select-none">
      {/* Group Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-4 shadow-sm">
        <h1 className="truncate font-bold text-white text-sm" title={activeGroupMeta.name}>
          {activeGroupMeta.name}
        </h1>
        {defaultInviteCode && (
          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title={`Davet Kodunu Kopyala (${defaultInviteCode})`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Share2 className="h-3.5 w-3.5 text-indigo-400" />
            )}
            <span>{copied ? 'Kopyalandı' : 'Davet'}</span>
          </button>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Text Channels */}
        <div>
          <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Metin Kanalları</span>
            <button
              onClick={() => setShowAddChannel(!showAddChannel)}
              className="text-slate-400 hover:text-white"
              title="Kanal Ekle"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {showAddChannel && (
            <form onSubmit={handleCreateChannel} className="mt-2 px-2">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="kanal-adı"
                className="w-full rounded bg-slate-950 px-2 py-1 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
            </form>
          )}

          <div className="mt-1 space-y-0.5">
            {textChannels.map((channel) => {
              const isActive = activeChannelId === channel.id;
              return (
                <button
                  key={channel.id}
                  onClick={() => {
                    setActiveChannel(channel.id);
                    wsService.fetchHistory(channel.id);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Hash className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Channels (Phase 3 Prep) */}
        {voiceChannels.length > 0 && (
          <div>
            <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Ses Kanalları
            </div>
            <div className="mt-1 space-y-0.5">
              {voiceChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 opacity-60"
                  title="Ses kanalları Faz 3 ile aktifleşecek"
                >
                  <Volume2 className="h-4 w-4" />
                  <span className="truncate">{channel.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Status Bar */}
      <div className="flex h-14 items-center bg-slate-950/80 px-3 border-t border-slate-800/60">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow"
          style={{ backgroundColor: identity?.avatarColor ?? '#4f46e5' }}
        >
          {identity?.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="ml-2.5 flex-1 min-w-0">
          <div className="truncate text-xs font-semibold text-white">{identity?.displayName}</div>
          <div className="text-[10px] text-emerald-400">Çevrimiçi</div>
        </div>
      </div>
    </div>
  );
};
