import React from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Activity,
  VolumeX,
} from 'lucide-react';
import { useVoiceStore } from '../stores/useVoiceStore';
import { webrtcService } from '../services/webrtc';
import { VoiceDiagnosticsModal } from './VoiceDiagnosticsModal';

export const VoicePanel: React.FC = () => {
  const {
    connectionStatus,
    currentChannelName,
    isMuted,
    isDeafened,
    isSpeaking,
    pingMs,
    setDiagnosticsOpen,
  } = useVoiceStore();

  if (connectionStatus === 'disconnected') {
    return null;
  }

  const isConnected = connectionStatus === 'connected';

  const getRttBadgeColor = (rtt: number) => {
    if (rtt <= 50) return 'text-emerald-400';
    if (rtt <= 120) return 'text-yellow-400';
    return 'text-rose-400';
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
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-emerald-400 truncate">
                  {isConnected ? 'Ses Bağlandı' : 'Bağlanıyor...'}
                </span>
                {isConnected && pingMs > 0 && (
                  <span className={`text-[10px] font-mono font-medium ${getRttBadgeColor(pingMs)}`}>
                    {pingMs}ms
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-slate-400 font-medium">
                {currentChannelName} / RTC Mesh
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
              onClick={() => webrtcService.leave()}
              className="rounded p-1.5 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
              title="Bağlantıyı Kes"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
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
    </>
  );
};
