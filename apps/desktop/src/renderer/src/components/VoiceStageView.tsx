import React, { useRef, useState, useEffect } from 'react';
import {
  Volume2,
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Video,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Users,
  Radio,
  Activity,
  Monitor,
  MonitorOff,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import {
  type Channel,
  type VoiceParticipant,
  type ScreenShareState,
  UserAudioState,
  computeAudioState,
} from '@echo/shared';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { webrtcService } from '../services/webrtc';
import { VoiceDiagnosticsModal } from './VoiceDiagnosticsModal';
import { useScreenShareViewerDucking } from '../hooks/useScreenShareViewerDucking';

interface Props {
  channel: Channel;
}

interface ParticipantTileProps {
  participant: VoiceParticipant;
  isLocal: boolean;
  stream?: MediaStream;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isLocal,
  stream,
  isSpeaking,
  isMuted,
  isDeafened,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      void el.play().catch((e) => console.warn('Tile video play error:', e));
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      void videoRef.current.play().catch((e) => console.warn('Tile video play error:', e));
    }
  }, [stream, participant.camera]);

  const hasVideo = Boolean(stream && participant.camera);

  return (
    <div
      className={`group relative flex flex-col items-center justify-center rounded-2xl bg-slate-950/80 border overflow-hidden aspect-video shadow-lg transition-all duration-200 ${
        isSpeaking
          ? 'border-emerald-500/80 ring-2 ring-emerald-500/50 shadow-emerald-500/10'
          : 'border-slate-800/80 hover:border-slate-700'
      }`}
    >
      {hasVideo ? (
        <video
          ref={attachVideo}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover rounded-2xl ${isLocal ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black text-white shadow-xl transition-all duration-200 ${
                isSpeaking
                  ? 'ring-4 ring-emerald-400 ring-offset-4 ring-offset-slate-950 scale-105 shadow-emerald-500/30'
                  : 'ring-2 ring-slate-700'
              }`}
              style={{ backgroundColor: '#4f46e5' }}
            >
              {participant.displayName.charAt(0).toUpperCase()}
            </div>
            {isSpeaking && (
              <span className="absolute -inset-2 rounded-full bg-emerald-400/20 animate-ping" />
            )}
          </div>
        </div>
      )}

      {/* Top badges (Live Camera badge) */}
      {hasVideo && (
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-slate-950/70 backdrop-blur px-2 py-0.5 border border-slate-800 text-[11px] font-medium text-slate-300">
          <Video className="h-3 w-3 text-emerald-400" />
          <span>Kamera</span>
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-xl bg-slate-950/80 backdrop-blur px-3 py-1.5 border border-slate-800/60 transition-opacity duration-150">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`truncate text-xs font-semibold ${
              isSpeaking ? 'text-emerald-300' : 'text-slate-200'
            }`}
          >
            {participant.displayName}
          </span>
          {isLocal && (
            <span className="shrink-0 rounded bg-indigo-500/20 px-1.5 py-0.2 text-[10px] font-medium text-indigo-300 border border-indigo-500/30">
              Sen
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMuted && (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30"
              title="Mikrofon Susturuldu"
            >
              <MicOff className="h-3 w-3" />
            </span>
          )}
          {isDeafened && (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30"
              title="Sağırlaştırıldı"
            >
              <VolumeX className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface ScreenShareTileProps {
  share: ScreenShareState;
  isLocal: boolean;
  channelId: string;
}

const ScreenShareTile: React.FC<ScreenShareTileProps> = ({ share, isLocal, channelId }) => {
  const {
    localStream,
    viewingShare,
    watchStream,
    stopWatching,
    stopSharing,
    openModalViewer,
    viewerVolume,
    isViewerMuted,
    setViewerVolume,
    setIsViewerMuted,
  } = useScreenShareStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isCurrentlyViewing = isLocal || viewingShare?.userId === share.userId;
  const stream = isLocal ? localStream : viewingShare?.stream;
  const isLoading = !isLocal && viewingShare?.userId === share.userId && viewingShare.isLoading;

  const { isDucked, effectiveVolume } = useScreenShareViewerDucking({
    videoRef,
    userVolume: viewerVolume,
    isMuted: isViewerMuted,
    isLocal,
  });

  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.muted = isLocal || isViewerMuted || effectiveVolume === 0;
      if (!isLocal) {
        el.volume = isViewerMuted ? 0 : effectiveVolume;
      }
      void el.play().catch((e) => console.warn('Tile video play error:', e));
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.muted = isLocal || isViewerMuted || effectiveVolume === 0;
      if (!isLocal) {
        videoRef.current.volume = isViewerMuted ? 0 : effectiveVolume;
      }
      void videoRef.current.play().catch((e) => console.warn('Tile video play error:', e));
    }
  }, [stream, isLocal, isViewerMuted, effectiveVolume]);

  const toggleTileFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFs = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`group relative flex flex-col items-center justify-center rounded-2xl bg-slate-950 border border-slate-800/90 overflow-hidden aspect-video shadow-xl transition-all duration-200 hover:border-slate-700 ${
        isFullscreen ? 'w-full h-full rounded-none' : ''
      }`}
    >
      {isCurrentlyViewing ? (
        <>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold text-slate-300">
                {share.displayName} kullanıcısının yayınına bağlanılıyor...
              </span>
            </div>
          ) : stream ? (
            <video
              ref={attachVideo}
              autoPlay
              playsInline
              muted={isLocal}
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
              <Monitor className="h-8 w-8 text-slate-600" />
              <span>Yayın hazırlanıyor...</span>
            </div>
          )}

          {/* Top Bar Hover Overlay */}
          <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                <Radio className="h-3 w-3 animate-pulse" />
                <span>CANLI</span>
              </div>
              <span className="rounded-md bg-slate-950/80 backdrop-blur px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-800">
                {isLocal ? 'Senin Ekranın' : `${share.displayName} kullanıcısının ekranı`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTileFullscreen}
                className="rounded-lg bg-slate-950/80 backdrop-blur p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition border border-slate-800"
                title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={openModalViewer}
                className="rounded-lg bg-slate-950/80 backdrop-blur p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition border border-slate-800"
                title="Ayrı Pencerede Büyüt"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Bottom Bar Controls Overlay */}
          <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between rounded-xl bg-slate-950/85 backdrop-blur px-3 py-1.5 border border-slate-800/80 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <Monitor className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-white truncate">
                {isLocal ? 'Ekran Paylaşımın' : share.displayName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Audio Volume Controls for Viewers */}
              {!isLocal && (
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 backdrop-blur px-2 py-1 border border-slate-700/60 shadow">
                  <button
                    type="button"
                    onClick={() => setIsViewerMuted(!isViewerMuted)}
                    className="text-slate-300 hover:text-white transition"
                    title={isViewerMuted ? 'Yayın Sesini Aç' : 'Yayın Sesini Sustur'}
                  >
                    {isViewerMuted || viewerVolume === 0 ? (
                      <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5 text-slate-200" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isViewerMuted ? 0 : viewerVolume}
                    onChange={(e) => {
                      setViewerVolume(parseFloat(e.target.value));
                      if (isViewerMuted) setIsViewerMuted(false);
                    }}
                    className="w-16 h-1 accent-indigo-500 cursor-pointer bg-slate-700 rounded-lg"
                    title={`Yayın Sesi: %${Math.round((isViewerMuted ? 0 : viewerVolume) * 100)}`}
                  />
                  {isDucked && (
                    <span
                      className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded animate-pulse"
                      title="Konuştuğunuz için sesiniz yayından yankılanmasın diye yayın sesi otomatik olarak kısıldı"
                    >
                      Yankı Koruması
                    </span>
                  )}
                </div>
              )}

              {isLocal ? (
                <button
                  type="button"
                  onClick={() => stopSharing(channelId)}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 text-xs font-semibold shadow transition"
                >
                  <MonitorOff className="h-3.5 w-3.5" />
                  <span>Yayını Durdur</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => stopWatching()}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white px-2.5 py-1 text-xs font-semibold border border-slate-700/60 transition"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>İzlemeyi Bırak</span>
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Remote preview card: Click to watch */
        <div className="flex flex-col items-center justify-center p-6 text-center select-none w-full h-full bg-gradient-to-b from-slate-900/90 to-slate-950">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-md">
            <Radio className="h-3 w-3 animate-pulse" />
            <span>CANLI YAYIN</span>
          </div>

          <div className="relative mb-3">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white shadow-xl ring-2 ring-indigo-500/50"
              style={{ backgroundColor: '#6366f1' }}
            >
              {share.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow">
              <Monitor className="h-3.5 w-3.5" />
            </div>
          </div>

          <h3 className="text-sm font-bold text-white">{share.displayName}</h3>
          <p className="text-xs text-slate-400 mt-0.5">ekranını paylaşıyor</p>

          <button
            type="button"
            onClick={() => watchStream(share.userId, share.displayName, channelId)}
            className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2 text-xs font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            <Eye className="h-4 w-4" />
            <span>Yayını İzle</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const VoiceStageView: React.FC<Props> = ({ channel }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTogglingCamera, setIsTogglingCamera] = useState(false);

  const { identity } = useAuthStore();
  const { activeGroupMeta } = useChatStore();
  const {
    currentChannelId,
    channelParticipants,
    audioState,
    isCameraActive,
    cameraStreams,
    pingMs,
    setDiagnosticsOpen,
  } = useVoiceStore();

  const { isSharing, stopSharing, activeShares } = useScreenShareStore();

  const isCurrentChannel = currentChannelId === channel.id;
  const participants = channelParticipants[channel.id] ?? [];

  // Active screen shares for this channel
  const channelShares = activeShares.filter((s) => s.channelId === channel.id);
  const isLocalSharingHere = isSharing && currentChannelId === channel.id;
  const hasLocalInShares = channelShares.some((s) => s.userId === identity?.userId);
  const effectiveShares: ScreenShareState[] = [...channelShares];
  if (isLocalSharingHere && !hasLocalInShares && identity) {
    effectiveShares.push({
      channelId: channel.id,
      userId: identity.userId,
      displayName: identity.displayName,
      isSharing: true,
      quality: '720p30',
      mode: 'motion',
      hasAudio: false,
      viewersCount: 0,
    });
  }

  // Toggle fullscreen mode
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleCamera = async () => {
    if (isTogglingCamera) return;
    setIsTogglingCamera(true);
    try {
      await webrtcService.toggleCamera();
    } finally {
      setIsTogglingCamera(false);
    }
  };

  const handleJoinOrLeave = () => {
    if (!isCurrentChannel && activeGroupMeta) {
      void webrtcService.join(activeGroupMeta.id, activeGroupMeta.name, channel.id, channel.name);
    } else if (isCurrentChannel) {
      if (isSharing) {
        void stopSharing(channel.id);
      }
      webrtcService.leave();
    }
  };

  // Determine grid columns based on total tile count (participants + screen shares)
  const totalCount = Math.max(1, participants.length + effectiveShares.length);
  const gridLayoutClass =
    totalCount === 1
      ? 'grid-cols-1 max-w-3xl'
      : totalCount === 2
        ? 'grid-cols-1 md:grid-cols-2 max-w-5xl'
        : totalCount <= 4
          ? 'grid-cols-2 max-w-5xl'
          : totalCount <= 6
            ? 'grid-cols-2 lg:grid-cols-3 max-w-6xl'
            : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-7xl';

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-slate-900 select-none overflow-hidden relative"
    >
      {/* Header bar */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-4 bg-slate-900/90 backdrop-blur z-10 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
            <Volume2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-sm truncate">{channel.name}</h1>
              {isCurrentChannel && pingMs > 0 && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold">
                  {pingMs}ms
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Users className="h-3.5 w-3.5" />
              <span>{participants.length} Katılımcı</span>
              <span className="text-slate-600">•</span>
              <span>480p24 WebRTC Mesh</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* WebRTC Diagnostics */}
          {isCurrentChannel && (
            <button
              type="button"
              onClick={() => setDiagnosticsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition border border-slate-800"
              title="Bağlantı & Mesh Tanısı"
            >
              <Activity className="h-4 w-4 text-indigo-400" />
              <span className="hidden sm:inline">Tanı</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="flex items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition border border-slate-800"
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Video Stage Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
        {participants.length === 0 && effectiveShares.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center max-w-sm p-8 rounded-3xl bg-slate-950/40 border border-slate-800/60">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
              <Radio className="h-8 w-8 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white mb-1">Kanalda Kimse Yok</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bu ses kanalında henüz kimse bulunmuyor. Konuşmayı başlatmak veya kamera açmak için
                aşağıdaki düğmeyle katılın.
              </p>
            </div>
            <button
              onClick={handleJoinOrLeave}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20"
            >
              <Volume2 className="h-4 w-4" />
              <span>Kanala Katıl</span>
            </button>
          </div>
        ) : (
          <div className={`grid w-full gap-3.5 my-auto ${gridLayoutClass}`}>
            {/* Screen share tiles in stage center */}
            {effectiveShares.map((s) => (
              <ScreenShareTile
                key={`share-${s.userId}`}
                share={s}
                isLocal={s.userId === identity?.userId}
                channelId={channel.id}
              />
            ))}

            {/* Participant camera/voice tiles */}
            {participants.map((p) => {
              const isLocal = p.userId === identity?.userId;
              const stream = isLocal
                ? cameraStreams['local'] || cameraStreams[p.userId]
                : cameraStreams[p.userId];
              const pAudioState = isLocal
                ? audioState
                : computeAudioState({ muted: p.muted, deafened: p.deafened, speaking: p.speaking });
              const speaking = pAudioState === UserAudioState.SPEAKING;
              const muted = pAudioState === UserAudioState.MUTED;
              const deafened = pAudioState === UserAudioState.DEAFENED;

              return (
                <ParticipantTile
                  key={p.userId}
                  participant={p}
                  isLocal={isLocal}
                  stream={stream}
                  isSpeaking={speaking}
                  isMuted={muted}
                  isDeafened={deafened}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Floating Controls Toolbar */}
      {isCurrentChannel && (() => {
        const isMuted = audioState === UserAudioState.MUTED || audioState === UserAudioState.DEAFENED;
        const isDeafened = audioState === UserAudioState.DEAFENED;

        return (
          <div className="p-3 flex justify-center z-10">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-950/90 backdrop-blur-md px-4 py-2 border border-slate-800 shadow-2xl">
              {/* Camera Toggle Button */}
              <button
                type="button"
                onClick={handleToggleCamera}
                disabled={isTogglingCamera}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition border ${
                  isCameraActive
                    ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
                title={isCameraActive ? 'Kamerayı Kapat' : 'Kamerayı Aç'}
              >
                {isCameraActive ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <VideoOff className="h-4 w-4 text-slate-400" />
                )}
                <span className="hidden sm:inline">
                  {isCameraActive ? 'Kamera Açık' : 'Kamera Aç'}
                </span>
              </button>

              {/* Microphone Mute Button */}
              <button
                type="button"
                onClick={() => webrtcService.toggleMute()}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition border ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
                title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}
              >
                {isMuted ? (
                  <MicOff className="h-4 w-4 text-rose-400" />
                ) : (
                  <Mic className="h-4 w-4 text-emerald-400" />
                )}
                <span className="hidden sm:inline">
                  {isMuted ? 'Susturuldu' : 'Sustur'}
                </span>
              </button>

              {/* Deafen Button */}
              <button
                type="button"
                onClick={() => webrtcService.toggleDeafen()}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition border ${
                  isDeafened
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
                title={isDeafened ? 'Sağırlaştırmayı Kaldır' : 'Sağırlaştır'}
              >
                {isDeafened ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Headphones className="h-4 w-4 text-indigo-400" />
                )}
                <span className="hidden sm:inline">{isDeafened ? 'Sağır' : 'Kulaklık'}</span>
              </button>

              <div className="h-6 w-px bg-slate-800 mx-1" />

              {/* Disconnect Button */}
              <button
                type="button"
                onClick={handleJoinOrLeave}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition shadow-lg shadow-rose-600/20"
                title="Ses Kanalından Ayrıl"
              >
                <PhoneOff className="h-4 w-4" />
                <span className="hidden sm:inline">Ayrıl</span>
              </button>
            </div>
          </div>
        );
      })()}
      <VoiceDiagnosticsModal />
    </div>
  );
};
