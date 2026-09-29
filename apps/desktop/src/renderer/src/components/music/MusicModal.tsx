import React, { useState, useEffect } from 'react';
import {
  Music,
  Search,
  Play,
  Pause,
  SkipForward,
  Square,
  Repeat,
  Volume2,
  VolumeX,
  ListPlus,
  Trash2,
  X,
  Loader2,
  Radio,
} from 'lucide-react';
import type { MusicTrack } from '@echo/shared';
import { useMusicStore } from '../../stores/useMusicStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { wsService } from '../../services/websocket';
import { SERVER_HTTP_URL } from '../../config';

export const MusicModal: React.FC = () => {
  const { currentChannelId } = useVoiceStore();
  const { identity } = useAuthStore();
  const {
    isPanelOpen,
    setPanelOpen,
    volume,
    setVolume,
    isMuted,
    toggleMute,
  } = useMusicStore();

  const playbackState = useMusicStore((state) =>
    currentChannelId ? state.playbackStates[currentChannelId] ?? null : null,
  );

  const [activeTab, setActiveTab] = useState<'player' | 'search' | 'queue'>('player');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [seekTime, setSeekTime] = useState<number | null>(null);

  const currentTrack = playbackState?.currentTrack;
  const status = playbackState?.status ?? 'stopped';
  const queue = playbackState?.queue ?? [];
  const loopMode = playbackState?.loopMode ?? 'off';
  const durationSec = currentTrack?.durationSeconds || 180;

  // Real-time ticking playback position
  const [currentPosition, setCurrentPosition] = useState(playbackState?.positionSeconds ?? 0);

  useEffect(() => {
    if (status !== 'playing') {
      setCurrentPosition(playbackState?.positionSeconds ?? 0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - (playbackState?.lastUpdatedTimestamp ?? Date.now())) / 1000;
      const pos = Math.min(durationSec, (playbackState?.positionSeconds ?? 0) + elapsed);
      setCurrentPosition(pos);
    }, 500);

    return () => clearInterval(interval);
  }, [status, playbackState?.positionSeconds, playbackState?.lastUpdatedTimestamp, durationSec]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `${SERVER_HTTP_URL}/api/music/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { results: MusicTrack[] };
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.warn('Music search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlayNow = (track: MusicTrack) => {
    if (!currentChannelId || !identity) return;
    const fullTrack: MusicTrack = {
      ...track,
      addedByUserId: identity.userId,
      addedByName: identity.displayName,
    };
    wsService.sendMusicAction({
      action: 'play',
      channelId: currentChannelId,
      track: fullTrack,
    });
    setActiveTab('player');
  };

  const handleAddToQueue = (track: MusicTrack) => {
    if (!currentChannelId || !identity) return;
    const fullTrack: MusicTrack = {
      ...track,
      addedByUserId: identity.userId,
      addedByName: identity.displayName,
    };
    wsService.sendMusicAction({
      action: 'queue_add',
      channelId: currentChannelId,
      track: fullTrack,
    });
  };

  const handleTogglePlayPause = () => {
    if (!currentChannelId) return;
    if (status === 'playing') {
      wsService.sendMusicAction({ action: 'pause', channelId: currentChannelId });
    } else if (status === 'paused') {
      wsService.sendMusicAction({ action: 'resume', channelId: currentChannelId });
    } else if (currentTrack) {
      wsService.sendMusicAction({ action: 'play', channelId: currentChannelId });
    }
  };

  const handleSkip = () => {
    if (!currentChannelId) return;
    wsService.sendMusicAction({ action: 'skip', channelId: currentChannelId });
  };

  const handleStop = () => {
    if (!currentChannelId) return;
    wsService.sendMusicAction({ action: 'stop', channelId: currentChannelId });
  };

  const handleToggleLoop = () => {
    if (!currentChannelId) return;
    const nextMode = loopMode === 'off' ? 'all' : loopMode === 'all' ? 'single' : 'off';
    wsService.sendMusicAction({ action: 'loop_mode', channelId: currentChannelId, mode: nextMode });
  };

  const handleRemoveQueueItem = (trackId: string) => {
    if (!currentChannelId) return;
    wsService.sendMusicAction({ action: 'queue_remove', channelId: currentChannelId, trackId });
  };

  const handleSeekCommit = (newPos: number) => {
    if (!currentChannelId) return;
    setSeekTime(null);
    wsService.sendMusicAction({
      action: 'seek',
      channelId: currentChannelId,
      positionSeconds: newPos,
    });
  };

  const formatSeconds = (sec: number) => {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  if (!isPanelOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0f172a] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5 bg-slate-900/60">
          <div className="flex items-center gap-2.5 text-indigo-400">
            <Radio className="h-5 w-5 animate-pulse text-indigo-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Birlikte Dinle & İzle (YouTube)
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-5 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('player')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'player'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Çalan Parça
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            Şarkı / Video Ara
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Kuyruk ({queue.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 min-h-[340px] flex flex-col justify-between">
          {/* TAB 1: PLAYER */}
          {activeTab === 'player' && (
            <div className="flex flex-col items-center justify-center flex-1 py-2">
              {currentTrack ? (
                <div className="w-full flex flex-col items-center">
                  {/* Thumbnail / Art */}
                  <div className="relative group w-48 h-28 md:w-64 md:h-36 rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-black mb-4 cursor-pointer">
                    <img
                      src={currentTrack.thumbnailUrl}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5 pointer-events-none">
                      <span className="text-[10px] text-indigo-300 font-mono">
                        Ekleyen: {currentTrack.addedByName}
                      </span>
                    </div>
                  </div>

                  {/* Title & Author */}
                  <h3 className="text-sm font-bold text-white text-center line-clamp-1 max-w-md px-2">
                    {currentTrack.title}
                  </h3>
                  <p className="text-xs text-slate-400 text-center mb-4">{currentTrack.author}</p>

                  {/* Progress Slider */}
                  <div className="w-full max-w-md px-2 flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-mono text-slate-400 w-10 text-right">
                      {formatSeconds(seekTime !== null ? seekTime : currentPosition)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={durationSec}
                      value={seekTime !== null ? seekTime : Math.min(durationSec, currentPosition)}
                      onChange={(e) => setSeekTime(Number(e.target.value))}
                      onMouseUp={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                      onTouchEnd={(e) =>
                        handleSeekCommit(Number((e.target as HTMLInputElement).value))
                      }
                      className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] font-mono text-slate-400 w-10">
                      {currentTrack.duration || formatSeconds(durationSec)}
                    </span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleToggleLoop}
                      className={`p-2 rounded-lg transition ${
                        loopMode !== 'off'
                          ? 'text-indigo-400 bg-indigo-950/60'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title={
                        loopMode === 'all'
                          ? 'Tümünü Tekrarla'
                          : loopMode === 'single'
                            ? 'Tek Parçayı Tekrarla'
                            : 'Tekrar Kapalı'
                      }
                    >
                      <Repeat className="h-4 w-4" />
                      {loopMode === 'single' && (
                        <span className="text-[9px] absolute font-bold ml-3 -mt-2">1</span>
                      )}
                    </button>

                    <button
                      onClick={handleTogglePlayPause}
                      className="h-11 w-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition active:scale-95"
                    >
                      {status === 'playing' ? (
                        <Pause className="h-5 w-5 fill-current" />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5 fill-current" />
                      )}
                    </button>

                    <button
                      onClick={handleSkip}
                      className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                      title="Sıradakine Geç"
                    >
                      <SkipForward className="h-5 w-5" />
                    </button>

                    <button
                      onClick={handleStop}
                      className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                      title="Durdur & Sırayı Temizle"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6">
                  <div className="h-16 w-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
                    <Music className="h-8 w-8 text-indigo-400/60" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">Şu an müzik çalmıyor</h4>
                  <p className="text-xs text-slate-400 max-w-xs mb-4">
                    YouTube'dan şarkı aratıp hemen çalabilir veya sıraya ekleyebilirsiniz.
                  </p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                  >
                    Şarkı Ara
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SEARCH */}
          {activeTab === 'search' && (
            <div className="flex flex-col flex-1 gap-3">
              <form onSubmit={handleSearch} className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="YouTube linki yapıştırın veya şarkı adı yazın..."
                  autoFocus
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Ara
                </button>
              </form>

              {/* Search Results List */}
              <div className="flex-1 overflow-y-auto max-h-64 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {isSearching ? (
                  <div className="flex items-center justify-center h-40 text-slate-400 text-xs gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    <span>YouTube'da aranıyor...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-slate-500 text-xs">
                    {searchQuery ? 'Sonuç bulunamadı.' : 'Aramak için bir şarkı veya YouTube linki girin.'}
                  </div>
                ) : (
                  searchResults.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/60 transition gap-3"
                    >
                      <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="w-16 h-10 object-cover rounded-lg bg-black flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-semibold text-white truncate">{track.title}</h5>
                        <p className="text-[10px] text-slate-400 truncate">
                          {track.author} {track.duration ? `• ${track.duration}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handlePlayNow(track)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium flex items-center gap-1 transition"
                          title="Hemen Çal"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          Çal
                        </button>
                        <button
                          onClick={() => handleAddToQueue(track)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
                          title="Sıraya Ekle"
                        >
                          <ListPlus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUEUE */}
          {activeTab === 'queue' && (
            <div className="flex flex-col flex-1 gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Sıradaki Parçalar ({queue.length})</span>
                {queue.length > 0 && (
                  <button
                    onClick={() => {
                      if (currentChannelId) {
                        wsService.sendMusicAction({ action: 'stop', channelId: currentChannelId });
                      }
                    }}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    Kuyruğu Temizle
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto max-h-64 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-xs">
                    <p>Kuyrukta şarkı bulunmuyor.</p>
                    <button
                      onClick={() => setActiveTab('search')}
                      className="mt-2 text-indigo-400 hover:underline"
                    >
                      Aramadan şarkı ekle
                    </button>
                  </div>
                ) : (
                  queue.map((track, idx) => (
                    <div
                      key={`${track.id}-${idx}`}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 gap-3"
                    >
                      <span className="text-xs font-mono text-slate-500 w-4 text-center">
                        {idx + 1}
                      </span>
                      <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="w-12 h-8 object-cover rounded bg-black flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-semibold text-white truncate">{track.title}</h5>
                        <span className="text-[10px] text-slate-400">
                          {track.author} • {track.addedByName}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveQueueItem(track.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition"
                        title="Kaldır"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Bottom Audio / Volume Bar */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-1 hover:text-white transition"
                title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-slate-300" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  if (isMuted) toggleMute();
                  setVolume(Number(e.target.value));
                }}
                className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[10px] font-mono w-6">{isMuted ? '0%' : `${volume}%`}</span>
            </div>

            <span className="text-[10px] text-slate-500">Kişisel Ses Seviyesi</span>
          </div>
        </div>
      </div>
    </div>
  );
};
