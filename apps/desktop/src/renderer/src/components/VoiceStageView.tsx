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
} from 'lucide-react';
import {
  type Channel,
  type VoiceParticipant,
  UserAudioState,
  computeAudioState,
} from '@echo/shared';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { webrtcService } from '../services/webrtc';
import { VoiceDiagnosticsModal } from './VoiceDiagnosticsModal';

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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch((e) => console.warn('Tile video play error:', e));
    }
  }, [stream]);

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
          ref={videoRef}
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

  const { isSharing, stopSharing } = useScreenShareStore();

  const isCurrentChannel = currentChannelId === channel.id;
  const participants = channelParticipants[channel.id] ?? [];

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

  // Determine grid columns based on participant count
  const count = Math.max(1, participants.length);
  const gridLayoutClass =
    count === 1
      ? 'grid-cols-1 max-w-2xl'
      : count === 2
        ? 'grid-cols-1 md:grid-cols-2 max-w-4xl'
        : count <= 4
          ? 'grid-cols-2 max-w-4xl'
          : count <= 6
            ? 'grid-cols-2 lg:grid-cols-3 max-w-5xl'
            : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-6xl';

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
        {participants.length === 0 ? (
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
