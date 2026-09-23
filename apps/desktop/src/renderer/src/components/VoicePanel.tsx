import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Activity,
  VolumeX,
  Monitor,
  MonitorOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { webrtcService } from '../services/webrtc';
import { VoiceDiagnosticsModal } from './VoiceDiagnosticsModal';
import { ScreenSourcePickerModal } from './ScreenSourcePickerModal';

export const VoicePanel: React.FC = () => {
  const {
    connectionStatus,
    currentGroupName,
    currentChannelId,
    currentChannelName,
    isMuted,
    isDeafened,
    isSpeaking,
    isCameraActive,
    pingMs,
    localAudioLevel,
    isMicUnavailable,
    setDiagnosticsOpen,
  } = useVoiceStore();

  const { isSharing, viewerCount, stopSharing } = useScreenShareStore();
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [isTogglingCamera, setIsTogglingCamera] = useState(false);

  if (connectionStatus === 'disconnected') {
    return null;
  }

  const isConnected = connectionStatus === 'connected';

  const getRttBadgeColor = (rtt: number) => {
    if (rtt <= 50) return 'text-emerald-400';
    if (rtt <= 120) return 'text-yellow-400';
    return 'text-rose-400';
  };

  const handleDisconnect = () => {
    if (isSharing && currentChannelId) {
      void stopSharing(currentChannelId);
    }
    webrtcService.leave();
  };

  const handleToggleCamera = async () => {
    if (isTogglingCamera) return;
    setIsTogglingCamera(true);
    try {
      await webrtcService.toggleCamera();
    } finally {
      setIsTogglingCamera(false);
    }
  };

  return (
    <>
      <div className="border-t border-slate-800/80 bg-slate-950 px-3 py-2 select-none">
        {/* Connection status row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex items-center justify-center">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
                }`}
              />
              {isSpeaking && (
                <span className="absolute -inset-1 rounded-full bg-emerald-400/40 animate-ping" />
              )}
            </div>
            <div
              className="min-w-0 cursor-pointer hover:opacity-85 transition"
              onClick={() => {
                if (currentChannelId) {
                  useChatStore.getState().setActiveChannel(currentChannelId);
                }
              }}
              title="Ses Sahnesini Görüntüle"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-semibold truncate flex items-center gap-1.5 ${
                    isConnected ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {isConnected ? 'Ses Bağlandı' : 'RTC Bağlanıyor...'}
                </span>
                {isConnected && pingMs > 0 && (
                  <span className={`text-[10px] font-mono font-medium ${getRttBadgeColor(pingMs)}`}>
                    {pingMs}ms
                  </span>
                )}
              </div>
              <div
                className="truncate text-[11px] text-slate-400 font-medium"
                title={`${currentChannelName ?? ''} / ${currentGroupName ?? 'Ses'}`}
              >
                {currentChannelName} {currentGroupName ? `/ ${currentGroupName}` : '/ RTC Mesh'}
              </div>
              {/* Live Mic Activity Bar */}
              <div
                className="mt-1 flex items-center gap-1.5 w-32"
                title={`Mikrofon Sinyali: %${Math.round(localAudioLevel * 100)}`}
              >
                <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 rounded-full ${
                      isSpeaking ? 'bg-emerald-400' : localAudioLevel > 0.05 ? 'bg-indigo-400' : 'bg-transparent'
                    }`}
                    style={{ width: `${Math.min(100, Math.round(localAudioLevel * 100))}%` }}
                  />
                </div>
                {isMicUnavailable && (
                  <span className="text-[10px] text-amber-400 font-medium truncate">Sessiz</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Diagnostics modal button */}
            <button
              onClick={() => setDiagnosticsOpen(true)}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition"
              title="Bağlantı Tanısı & WebRTC İstatistikleri"
            >
              <Activity className="h-4 w-4" />
            </button>

            {/* Disconnect button */}
            <button
              onClick={handleDisconnect}
              className="rounded p-1.5 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
              title="Bağlantıyı Kes"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Media Stream Action Row (Camera & Screen Share) */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {/* Camera Button */}
          <button
            onClick={handleToggleCamera}
            disabled={isTogglingCamera}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-semibold border transition shadow-sm ${
              isCameraActive
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white hover:border-slate-700'
            }`}
            title={isCameraActive ? 'Kamerayı Kapat' : 'Kamera Aç'}
          >
            {isCameraActive ? (
              <Video className="h-3.5 w-3.5 text-white" />
            ) : (
              <VideoOff className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span>{isCameraActive ? 'Kamera Açık' : 'Kamera'}</span>
          </button>

          {/* Screen Share Button */}
          {isSharing ? (
            <div className="flex items-center justify-between rounded-lg bg-indigo-950/60 border border-indigo-500/30 px-2 py-1">
              <span className="text-[11px] font-bold text-indigo-200 truncate">
                {viewerCount > 0 ? `${viewerCount} izleyici` : 'Canlı'}
              </span>
              <button
                onClick={() => currentChannelId && void stopSharing(currentChannelId)}
                className="rounded p-1 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition shrink-0"
                title="Yayını Durdur"
              >
                <MonitorOff className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSourcePicker(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-1.5 px-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition shadow-sm"
              title="Ekran Paylaş"
            >
              <Monitor className="h-3.5 w-3.5 text-slate-400" />
              <span>Ekran Paylaş</span>
            </button>
          )}
        </div>

        {/* Audio control buttons row */}
        <div className="flex items-center justify-around rounded-lg bg-slate-900/90 py-1 px-2 border border-slate-800/60">
          {/* Mute button */}
          <button
            onClick={() => webrtcService.toggleMute()}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition ${
              isMuted || isDeafened
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
          >
            {isMuted || isDeafened ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            <span>{isMuted || isDeafened ? 'Susturuldu' : 'Sustur'}</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          {/* Deafen button */}
          <button
            onClick={() => webrtcService.toggleDeafen()}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition ${
              isDeafened
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title={isDeafened ? 'Sağırlaştırmayı Kaldır' : 'Sağırlaştır'}
          >
            {isDeafened ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Headphones className="h-3.5 w-3.5" />
            )}
            <span>{isDeafened ? 'Sağır' : 'Kulaklık'}</span>
          </button>
        </div>
      </div>

      <VoiceDiagnosticsModal />
      <ScreenSourcePickerModal
        isOpen={showSourcePicker}
        onClose={() => setShowSourcePicker(false)}
      />
    </>
  );
};
