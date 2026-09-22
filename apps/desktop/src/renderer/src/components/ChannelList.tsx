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
  ChevronDown,
  Trash2,
  LogOut,
  MessageSquare,
  Radio,
  Video,
  Info,
} from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useDmStore } from '../stores/useDmStore';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { wsService } from '../services/websocket';
import { webrtcService } from '../services/webrtc';
import { SettingsModal } from './SettingsModal';
import { VoicePanel } from './VoicePanel';
import { DeleteGroupModal } from './DeleteGroupModal';
import { SERVER_HTTP_URL } from '../config';

export const ChannelList: React.FC = () => {
  const { identity } = useAuthStore();
  const {
    activeGroupId,
    activeGroupMeta,
    channels,
    activeChannelId,
    setActiveChannel,
    defaultInviteCode,
    unreadCounts,
  } = useChatStore();

  const { currentChannelId, channelParticipants, isSpeaking, isMuted, isDeafened } =
    useVoiceStore();

  const [copied, setCopied] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'voice' | 'notifications' | 'about'>('voice');

  const openSettings = (tab: 'voice' | 'notifications' | 'about' = 'voice') => {
    setSettingsTab(tab);
    setShowSettings(true);
  };
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isOwner = activeGroupMeta ? identity?.userId === activeGroupMeta.ownerId : false;
  const { threads, activePeer, setActivePeer } = useDmStore();
  const { activeShares, watchStream } = useScreenShareStore();

  if (!activeGroupId) {
    return (
      <div className="flex h-full w-60 flex-col bg-slate-900 border-r border-slate-800/60 select-none">
        {/* DM Header */}
        <div className="flex h-14 items-center border-b border-slate-800/80 px-4 shadow-sm">
          <h1 className="font-bold text-white text-sm">Direkt Mesajlar</h1>
        </div>

        {/* DM Navigation Items */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <button
            onClick={() => {
              useChatStore.getState().setActiveGroup(null);
              setActivePeer(null);
            }}
            className={`w-full rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2.5 transition text-left ${
              !activePeer
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <MessageSquare className="h-4 w-4 text-indigo-400" />
            <span>Ana Sayfa & Arkadaşlar</span>
          </button>

          <div className="pt-4 px-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              <span>Direkt Mesajlar</span>
              {threads.length > 0 && <span>({threads.length})</span>}
            </div>

            {threads.length === 0 ? (
              <p className="text-[11px] text-slate-500 leading-relaxed px-1">
                Henüz aktif direkt mesajınız yok. Bir gruptan arkadaş seçip mesaj gönderebilirsiniz.
              </p>
            ) : (
              <div className="space-y-0.5">
                {threads.map((thread) => {
                  const isActive = activePeer?.peerId === thread.peerId;
                  return (
                    <button
                      key={thread.peerId}
                      onClick={() => {
                        useChatStore.getState().setActiveGroup(null);
                        setActivePeer({
                          peerId: thread.peerId,
                          peerName: thread.peerName,
                          peerColor: thread.peerColor,
                        });
                      }}
                      className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                        isActive
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow"
                          style={{ backgroundColor: thread.peerColor || '#6366f1' }}
                        >
                          {thread.peerName.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-xs">{thread.peerName}</span>
                      </div>

                      {thread.unreadCount > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                          {thread.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
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
            <div className="truncate text-xs font-semibold text-white">{identity?.displayName}</div>
            <div className="text-[10px] text-emerald-400">Çevrimiçi</div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => openSettings('about')}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Echo Hakkında & Sürüm Bilgileri"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={() => openSettings('voice')}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Ayarlar"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          initialTab={settingsTab}
        />
      </div>
    );
  }

  const handleCopyInvite = async () => {
    let code = defaultInviteCode;
    if (!code && activeGroupMeta?.id) {
      try {
        const res = await fetch(`${SERVER_HTTP_URL}/api/groups/${activeGroupMeta.id}/invite`);
        if (res.ok) {
          const data = (await res.json()) as { inviteCode?: string };
          if (data.inviteCode) {
            code = data.inviteCode;
            useChatStore.getState().setDefaultInviteCode(code);
          }
        }
      } catch {
        // ignore
      }
    }

    if (!code && activeGroupMeta?.id) {
      code = `ECHO-${activeGroupMeta.id.toLowerCase()}`;
    }

    if (!code) return;

    let success = false;
    if (window.echoApi?.copyToClipboard) {
      try {
        success = await window.echoApi.copyToClipboard(code);
      } catch (err) {
        console.warn('Native clipboard copy failed:', err);
      }
    }

    if (!success) {
      try {
        await navigator.clipboard.writeText(code);
        success = true;
      } catch (err) {
        console.warn('navigator.clipboard failed:', err);
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          success = document.execCommand('copy');
        } catch (_e) {
          void _e;
        }
        document.body.removeChild(textArea);
      }
    }

    if (success) {
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

  if (!activeGroupMeta) {
    return (
      <div className="flex h-full w-60 flex-col bg-slate-900 border-r border-slate-800/60 select-none">
        <div className="flex h-14 items-center border-b border-slate-800/80 px-4 shadow-sm animate-pulse">
          <div className="h-4 w-28 bg-slate-800 rounded" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          <div className="h-3 w-16 bg-slate-800/60 rounded" />
          <div className="h-6 w-full bg-slate-800/40 rounded" />
          <div className="h-6 w-full bg-slate-800/40 rounded" />
        </div>
        <VoicePanel />
      </div>
    );
  }

  return (
    <div className="flex h-full w-60 flex-col bg-slate-900 border-r border-slate-800/60 select-none">
      {/* Group Header */}
      <div className="relative border-b border-slate-800/80">
        <div className="flex h-14 w-full items-center justify-between px-3">
          {/* Group dropdown trigger */}
          <button
            type="button"
            onClick={() => setShowGroupMenu((prev) => !prev)}
            className="flex items-center gap-1.5 min-w-0 flex-1 px-1.5 py-1.5 rounded-md hover:bg-slate-800/50 transition text-left"
          >
            <h1 className="truncate font-bold text-white text-sm" title={activeGroupMeta.name}>
              {activeGroupMeta.name}
            </h1>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${
                showGroupMenu ? 'rotate-180 text-white' : ''
              }`}
            />
          </button>

          {/* Dedicated Invite Button */}
          <button
            type="button"
            onClick={handleCopyInvite}
            className={`flex items-center gap-1 shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
            }`}
            title={
              defaultInviteCode
                ? `Davet Kodunu Kopyala (${defaultInviteCode})`
                : 'Davet Kodunu Kopyala'
            }
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Share2 className="h-3.5 w-3.5 text-indigo-400" />
            )}
            <span>{copied ? 'Kopyalandı!' : 'Davet'}</span>
          </button>
        </div>

        {/* Group Dropdown Menu */}
        {showGroupMenu && (
          <div className="absolute left-2 right-2 top-14 z-40 rounded-lg bg-slate-950 p-2 border border-slate-800 shadow-2xl space-y-1.5">
            {/* Invite code visual box */}
            <div className="rounded-md bg-slate-900/90 p-2 border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Grup Davet Kodu
                </span>
                {copied && (
                  <span className="text-[10px] text-emerald-400 font-medium">Kopyalandı!</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 truncate rounded bg-slate-950 px-2 py-1 font-mono text-xs text-indigo-300 border border-slate-800 select-all">
                  {defaultInviteCode || `ECHO-${activeGroupMeta.id.toLowerCase()}`}
                </div>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="shrink-0 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 transition shadow"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : 'Kopyala'}
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-800/80 my-1" />

            <button
              type="button"
              onClick={() => {
                setShowGroupMenu(false);
                setShowAddChannel(true);
              }}
              className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition"
            >
              <span>Kanal Ekle</span>
              <Plus className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <div className="h-px bg-slate-800/80 my-1" />
            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  setShowGroupMenu(false);
                  setShowDeleteModal(true);
                }}
                className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20 transition font-medium"
              >
                <span>Grubu Sil</span>
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowGroupMenu(false);
                  setShowDeleteModal(true);
                }}
                className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition font-medium"
              >
                <span>Gruptan Ayrıl</span>
                <LogOut className="h-3.5 w-3.5 text-amber-400" />
              </button>
            )}
          </div>
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
                      if (!isVoiceActive && activeGroupMeta) {
                        void webrtcService.join(
                          activeGroupMeta.id,
                          activeGroupMeta.name,
                          channel.id,
                          channel.name,
                        );
                      }
                      setActiveChannel(channel.id);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition group ${
                      activeChannelId === channel.id
                        ? 'bg-slate-800 text-white font-semibold'
                        : isVoiceActive
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
                                speaking ? 'text-emerald-300 font-semibold' : 'text-slate-300'
                              }`}
                            >
                              {p.displayName} {isLocal && '(Sen)'}
                            </span>

                            {activeShares.some(
                              (s) => s.channelId === channel.id && s.userId === p.userId,
                            ) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isLocal) {
                                    void watchStream(p.userId, p.displayName, channel.id);
                                  }
                                }}
                                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold transition shadow-sm ${
                                  isLocal
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-default'
                                    : 'bg-rose-600 text-white hover:bg-rose-500 animate-pulse cursor-pointer'
                                }`}
                                title={isLocal ? 'Ekranını paylaşıyorsun' : 'Yayını İzle'}
                              >
                                <Radio className="h-2.5 w-2.5" />
                                <span>CANLI</span>
                              </button>
                            )}

                            <div className="ml-auto flex items-center gap-1">
                              {p.camera && (
                                <span title="Kamera açık">
                                  <Video className="h-3 w-3 text-emerald-400" />
                                </span>
                              )}
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
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => openSettings('about')}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Echo Hakkında & Sürüm Bilgileri"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            onClick={() => openSettings('voice')}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Ayarlar"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialTab={settingsTab}
      />

      {activeGroupMeta && (
        <DeleteGroupModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          groupId={activeGroupMeta.id}
          groupName={activeGroupMeta.name}
          isOwner={isOwner}
        />
      )}
    </div>
  );
};
