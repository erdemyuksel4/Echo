import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Activity, VolumeX, Monitor, MonitorOff, Video, VideoOff, Radio, } from 'lucide-react';
import { UserAudioState } from '@echo/shared';
import { useChatStore } from '../stores/useChatStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { webrtcService } from '../services/webrtc';
import { VoiceDiagnosticsModal } from './VoiceDiagnosticsModal';
import { ScreenSourcePickerModal } from './ScreenSourcePickerModal';
export const VoicePanel = () => {
    const { connectionStatus, currentGroupName, currentChannelId, currentChannelName, audioState, isSpeaking, isCameraActive, pingMs, localAudioLevel, isMicUnavailable, setDiagnosticsOpen, isSelfLoopbackActive, } = useVoiceStore();
    const { isSharing, viewerCount, stopSharing } = useScreenShareStore();
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [isTogglingCamera, setIsTogglingCamera] = useState(false);
    if (connectionStatus === 'disconnected') {
        return null;
    }
    const isConnected = connectionStatus === 'connected';
    const getRttBadgeColor = (rtt) => {
        if (rtt <= 50)
            return 'text-emerald-400';
        if (rtt <= 120)
            return 'text-yellow-400';
        return 'text-rose-400';
    };
    const handleDisconnect = () => {
        if (isSharing && currentChannelId) {
            void stopSharing(currentChannelId);
        }
        webrtcService.leave();
    };
    const handleToggleCamera = async () => {
        if (isTogglingCamera)
            return;
        setIsTogglingCamera(true);
        try {
            await webrtcService.toggleCamera();
        }
        finally {
            setIsTogglingCamera(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "border-t border-slate-800/80 bg-slate-950 px-3 py-2 select-none", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsxs("div", { className: "relative flex items-center justify-center", children: [_jsx("span", { className: `h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}` }), isSpeaking && (_jsx("span", { className: "absolute -inset-1 rounded-full bg-emerald-400/40 animate-ping" }))] }), _jsxs("div", { className: "min-w-0 cursor-pointer hover:opacity-85 transition", onClick: () => {
                                            if (currentChannelId) {
                                                useChatStore.getState().setActiveChannel(currentChannelId);
                                            }
                                        }, title: "Ses Sahnesini G\u00F6r\u00FCnt\u00FCle", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: `text-xs font-semibold truncate flex items-center gap-1.5 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`, children: isConnected ? 'Ses Bağlandı' : 'RTC Bağlanıyor...' }), isConnected && pingMs > 0 && (_jsxs("span", { className: `text-[10px] font-mono font-medium ${getRttBadgeColor(pingMs)}`, children: [pingMs, "ms"] })), isSelfLoopbackActive && (_jsx("span", { className: "rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/30 animate-pulse", children: "A\u011E TEST\u0130" }))] }), _jsxs("div", { className: "truncate text-[11px] text-slate-400 font-medium", title: `${currentChannelName ?? ''} / ${currentGroupName ?? 'Ses'}`, children: [currentChannelName, " ", currentGroupName ? `/ ${currentGroupName}` : '/ RTC Mesh'] }), _jsxs("div", { className: "mt-1 flex items-center gap-1.5 w-32", title: `Mikrofon Sinyali: %${Math.round(localAudioLevel * 100)}`, children: [_jsx("div", { className: "flex-1 h-1 bg-slate-800 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full transition-all duration-75 rounded-full ${isSpeaking ? 'bg-emerald-400' : localAudioLevel > 0.05 ? 'bg-indigo-400' : 'bg-transparent'}`, style: { width: `${Math.min(100, Math.round(localAudioLevel * 100))}%` } }) }), isMicUnavailable && (_jsx("span", { className: "text-[10px] text-amber-400 font-medium truncate", children: "Sessiz" }))] })] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => webrtcService.toggleSelfLoopback(), className: `rounded p-1.5 transition ${isSelfLoopbackActive
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-amber-400'}`, title: isSelfLoopbackActive
                                            ? 'Ağ & Ses Test Modu AÇIK (Kendi sesinizi Opus kodeki ve yapay zeka filtresiyle duyuyorsunuz)'
                                            : 'Ağ & Ses Test Modu (Kanalda tek başınıza sesinizi ve gürültü engellemeyi test edin)', children: _jsx(Radio, { className: `h-4 w-4 ${isSelfLoopbackActive ? 'animate-pulse text-amber-400' : ''}` }) }), _jsx("button", { onClick: () => setDiagnosticsOpen(true), className: "rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition", title: "Ba\u011Flant\u0131 Tan\u0131s\u0131 & WebRTC \u0130statistikleri", children: _jsx(Activity, { className: "h-4 w-4" }) }), _jsx("button", { onClick: handleDisconnect, className: "rounded p-1.5 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition", title: "Ba\u011Flant\u0131y\u0131 Kes", children: _jsx(PhoneOff, { className: "h-4 w-4" }) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-1.5 mb-2", children: [_jsxs("button", { onClick: handleToggleCamera, disabled: isTogglingCamera, className: `flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-semibold border transition shadow-sm ${isCameraActive
                                    ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white hover:border-slate-700'}`, title: isCameraActive ? 'Kamerayı Kapat' : 'Kamera Aç', children: [isCameraActive ? (_jsx(Video, { className: "h-3.5 w-3.5 text-white" })) : (_jsx(VideoOff, { className: "h-3.5 w-3.5 text-slate-400" })), _jsx("span", { children: isCameraActive ? 'Kamera Açık' : 'Kamera' })] }), isSharing ? (_jsxs("div", { className: "flex items-center justify-between rounded-lg bg-indigo-950/60 border border-indigo-500/30 px-2 py-1", children: [_jsx("span", { className: "text-[11px] font-bold text-indigo-200 truncate", children: viewerCount > 0 ? `${viewerCount} izleyici` : 'Canlı' }), _jsx("button", { onClick: () => currentChannelId && void stopSharing(currentChannelId), className: "rounded p-1 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition shrink-0", title: "Yay\u0131n\u0131 Durdur", children: _jsx(MonitorOff, { className: "h-3.5 w-3.5" }) })] })) : (_jsxs("button", { onClick: () => setShowSourcePicker(true), className: "flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-1.5 px-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition shadow-sm", title: "Ekran Payla\u015F", children: [_jsx(Monitor, { className: "h-3.5 w-3.5 text-slate-400" }), _jsx("span", { children: "Ekran Payla\u015F" })] }))] }), _jsxs("div", { className: "flex items-center justify-around rounded-lg bg-slate-900/90 py-1 px-2 border border-slate-800/60", children: [(() => {
                                const isMuted = audioState === UserAudioState.MUTED || audioState === UserAudioState.DEAFENED;
                                return (_jsxs("button", { onClick: () => webrtcService.toggleMute(), className: `flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition ${isMuted
                                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`, title: isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat', children: [isMuted ? (_jsx(MicOff, { className: "h-3.5 w-3.5" })) : (_jsx(Mic, { className: "h-3.5 w-3.5" })), _jsx("span", { children: isMuted ? 'Susturuldu' : 'Sustur' })] }));
                            })(), _jsx("div", { className: "h-4 w-px bg-slate-800" }), (() => {
                                const isDeafened = audioState === UserAudioState.DEAFENED;
                                return (_jsxs("button", { onClick: () => webrtcService.toggleDeafen(), className: `flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition ${isDeafened
                                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`, title: isDeafened ? 'Sağırlaştırmayı Kaldır' : 'Sağırlaştır', children: [isDeafened ? (_jsx(VolumeX, { className: "h-3.5 w-3.5" })) : (_jsx(Headphones, { className: "h-3.5 w-3.5" })), _jsx("span", { children: isDeafened ? 'Sağır' : 'Kulaklık' })] }));
                            })()] })] }), _jsx(VoiceDiagnosticsModal, {}), _jsx(ScreenSourcePickerModal, { isOpen: showSourcePicker, onClose: () => setShowSourcePicker(false) })] }));
};
