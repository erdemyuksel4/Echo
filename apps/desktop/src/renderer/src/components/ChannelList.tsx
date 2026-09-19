import React, { useState } from 'react';
import {
  Hash,
  Volume2,
  Plus,
  Share2,
  Check,
  Settings,
  MicOff,
  VolumeX,
} from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { wsService } from '../services/websocket';
import { webrtcService } from '../services/webrtc';
import { SettingsModal } from './SettingsModal';
import { VoicePanel } from './VoicePanel';

export const ChannelList: React.FC = () => {
  const { identity } = useAuthStore();
  const {
    activeGroupMeta,
    channels,
    activeChannelId,
    setActiveChannel,
    defaultInviteCode,
    unreadCounts,
  } = useChatStore();

  const {
    currentChannelId,
    channelParticipants,
    isSpeaking,
    isMuted,
    isDeafened,
  } = useVoiceStore();

  const [copied, setCopied] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [showSettings, setShowSettings] = useState(false);

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

        {/* Voice Panel (if connected) */}
        <VoicePanel />

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
          <button
            onClick={() => setShowSettings(true)}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Ayarlar"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
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
    wsService.createChannel(newChannelName, newChannelType);
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
        {/* Add Channel Modal Form */}
        {showAddChannel && (
          <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800 shadow-md">
            <form onSubmit={handleCreateChannel} className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                <span>Yeni Kanal Ekle</span>
                <button
                  type="button"
                  onClick={() => setShowAddChannel(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewChannelType('text')}
                  className={`flex-1 rounded py-1 text-[11px] font-medium transition ${
                    newChannelType === 'text'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  # Metin
                </button>
                <button
                  type="button"
                  onClick={() => setNewChannelType('voice')}
                  className={`flex-1 rounded py-1 text-[11px] font-medium transition ${
                    newChannelType === 'voice'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🔊 Sesli
                </button>
              </div>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder={newChannelType === 'text' ? 'kanal-adı' : 'Ses Kanalı Adı'}
                className="w-full rounded bg-slate-900 px-2 py-1 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                className="w-full rounded bg-indigo-600 py-1 text-xs font-semibold text-white hover:bg-indigo-500 transition"
              >
                Oluştur
              </button>
            </form>
          </div>
        )}

        {/* Text Channels */}
        <div>
          <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Metin Kanalları</span>
            <button
              onClick={() => {
                setNewChannelType('text');
                setShowAddChannel(true);
              }}
              className="text-slate-400 hover:text-white"
              title="Metin Kanalı Ekle"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1 space-y-0.5">
            {textChannels.map((channel) => {
              const isActive = activeChannelId === channel.id;
              const unread = unreadCounts[channel.id] ?? 0;

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
                  <Hash className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                  {unread > 0 && !isActive && (
                    <span className="ml-auto rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-bold text-white shadow">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Channels */}
        <div>
          <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Ses Kanalları</span>
            <button
              onClick={() => {
                setNewChannelType('voice');
                setShowAddChannel(true);
              }}
              className="text-slate-400 hover:text-white"
              title="Ses Kanalı Ekle"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1 space-y-1">
            {voiceChannels.map((channel) => {
              const isVoiceActive = currentChannelId === channel.id;
              const participants = channelParticipants[channel.id] ?? [];

              return (
                <div key={channel.id} className="space-y-0.5">
                  <button
                    onClick={() => {
                      if (!isVoiceActive) {
                        void webrtcService.join(channel.id, channel.name);
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition group ${
                      isVoiceActive
                        ? 'bg-emerald-950/40 text-emerald-300 font-semibold border border-emerald-800/40'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    <Volume2
                      className={`h-4 w-4 flex-shrink-0 ${
                        isVoiceActive
                          ? 'text-emerald-400'
                          : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    <span className="truncate">{channel.name}</span>
                    {participants.length > 0 && (
                      <span className="ml-auto text-[10px] font-mono rounded bg-slate-800 px-1.5 py-0.2 text-slate-400">
                        {participants.length}/10
                      </span>
                    )}
                  </button>

                  {/* Active Participants in this Voice Channel */}
                  {participants.length > 0 && (
                    <div className="pl-4 pr-1 py-1 space-y-1">
                      {participants.map((p) => {
                        const isLocal = p.userId === identity?.userId;
                        const speaking = isLocal ? isSpeaking : p.speaking;
                        const muted = isLocal ? isMuted : p.muted;
                        const deafened = isLocal ? isDeafened : p.deafened;

                        return (
                          <div
                            key={p.userId}
                            className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/40 transition"
                          >
                            <div className="relative flex items-center justify-center">
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white transition-all duration-150 ${
                                  speaking
                                    ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900 shadow-sm shadow-emerald-400/80 scale-105'
                                    : ''
                                }`}
                                style={{ backgroundColor: '#4f46e5' }}
                              >
                                {p.displayName.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <span
                              className={`truncate text-xs ${
                                speaking
                                  ? 'text-emerald-300 font-semibold'
                                  : 'text-slate-300'
                              }`}
                            >
                              {p.displayName} {isLocal && '(Sen)'}
                            </span>
                            <div className="ml-auto flex items-center gap-1">
                              {muted && (
                                <span title="Mikrofon kapalı">
                                  <MicOff className="h-3 w-3 text-rose-400" />
                                </span>
                              )}
                              {deafened && (
                                <span title="Kulaklık kapalı">
                                  <VolumeX className="h-3 w-3 text-rose-400" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Voice Panel (Active Voice Connection controls) */}
      <VoicePanel />

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
        <button
          onClick={() => setShowSettings(true)}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          title="Ayarlar"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

