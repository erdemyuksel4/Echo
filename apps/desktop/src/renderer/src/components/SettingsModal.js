import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Settings, Volume2, Bell, Shield, X, Mic, Headphones, Play, Square, Keyboard, Sliders, Laptop, Video, Info, CheckCircle2, RefreshCw, ExternalLink, Cpu, Layers, Sparkles, ShieldCheck, Radio, } from 'lucide-react';
import { soundService } from '../services/sound';
import { webrtcService } from '../services/webrtc';
import { useVoiceStore } from '../stores/useVoiceStore';
export const SettingsModal = ({ isOpen, onClose, initialTab = 'voice' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [appInfo, setAppInfo] = useState(null);
    const [updateStatus, setUpdateStatus] = useState(null);
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(soundService.isEnabled());
    const [notifEnabled, setNotifEnabled] = useState(() => {
        try {
            const stored = localStorage.getItem('echo_notifications_enabled');
            return stored === null ? true : stored === 'true';
        }
        catch {
            return true;
        }
    });
    const [audioProcessing, setAudioProcessing] = useState(() => webrtcService.getAudioProcessingSettings());
    const handleAudioProcessingToggle = (key) => {
        const updated = {
            ...audioProcessing,
            [key]: !audioProcessing[key],
        };
        setAudioProcessing(updated);
        void webrtcService.updateAudioProcessingSettings({ [key]: updated[key] });
    };
    const [inputDevices, setInputDevices] = useState([]);
    const [outputDevices, setOutputDevices] = useState([]);
    const [selectedInputId, setSelectedInputId] = useState(webrtcService.getInputDeviceId() || '');
    const [selectedOutputId, setSelectedOutputId] = useState(webrtcService.getOutputDeviceId() || '');
    const [outputVolume, setOutputVolume] = useState(Math.round(webrtcService.getOutputVolume() * 100));
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micLevel, setMicLevel] = useState(0);
    const [loopbackEnabled, setLoopbackEnabled] = useState(true);
    const [videoDevices, setVideoDevices] = useState([]);
    const [selectedVideoId, setSelectedVideoId] = useState(webrtcService.getVideoDeviceId() || '');
    const [isTestingCamera, setIsTestingCamera] = useState(false);
    const testVideoRef = useRef(null);
    const { inputMode, pttKeyDisplay, pttReleaseDelay, setInputMode, setPttReleaseDelay, isSelfLoopbackActive, } = useVoiceStore();
    const [isRecordingPttKey, setIsRecordingPttKey] = useState(false);
    const [autoStartEnabled, setAutoStartEnabled] = useState(false);
    useEffect(() => {
        if (isOpen) {
            if (initialTab) {
                setActiveTab(initialTab);
            }
            if (window.echoApi?.getAppInfo) {
                void window.echoApi.getAppInfo().then((info) => {
                    setAppInfo(info);
                });
            }
            if (window.echoApi?.getLoginItemSettings) {
                void window.echoApi.getLoginItemSettings().then((settings) => {
                    setAutoStartEnabled(Boolean(settings?.openAtLogin));
                });
            }
        }
    }, [isOpen, initialTab]);
    useEffect(() => {
        if (!isOpen || !window.echoApi?.onUpdateStatus)
            return;
        const cleanup = window.echoApi.onUpdateStatus((data) => {
            setIsCheckingUpdate(false);
            if (data.status === 'checking') {
                setUpdateStatus('Güncellemeler denetleniyor...');
            }
            else if (data.status === 'not-available') {
                setUpdateStatus('En güncel sürümü kullanıyorsunuz.');
            }
            else if (data.status === 'available') {
                setUpdateStatus(`Yeni sürüm bulundu (v${data.version || ''}), otomatik indiriliyor...`);
            }
            else if (data.status === 'downloaded') {
                setUpdateStatus(`Güncelleme indirildi (v${data.version || ''}), yeniden başlatılıyor...`);
            }
            else if (data.status === 'error') {
                setUpdateStatus(`Güncelleme kontrolü: ${data.error || 'Bağlantı hatası'}`);
            }
        });
        return cleanup;
    }, [isOpen]);
    useEffect(() => {
        if (!isRecordingPttKey)
            return;
        const handleKeyDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            let display = e.key.toUpperCase();
            if (e.code.startsWith('Key')) {
                display = e.code.replace('Key', '');
            }
            else if (e.code === 'Space') {
                display = 'Boşluk (Space)';
            }
            else if (e.code === 'ControlRight') {
                display = 'Sağ Ctrl';
            }
            else if (e.code === 'ControlLeft') {
                display = 'Sol Ctrl';
            }
            else if (e.code === 'AltRight') {
                display = 'Sağ Alt';
            }
            else if (e.code === 'AltLeft') {
                display = 'Sol Alt';
            }
            else if (e.code === 'ShiftRight') {
                display = 'Sağ Shift';
            }
            else if (e.code === 'ShiftLeft') {
                display = 'Sol Shift';
            }
            else if (e.code === 'CapsLock') {
                display = 'Caps Lock';
            }
            useVoiceStore.getState().setPttKey(e.code, display);
            setIsRecordingPttKey(false);
        };
        window.addEventListener('keydown', handleKeyDown, { once: true });
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isRecordingPttKey]);
    useEffect(() => {
        if (isOpen) {
            setAudioProcessing(webrtcService.getAudioProcessingSettings());
            void webrtcService.getAudioDevices().then(({ inputs, outputs }) => {
                setInputDevices(inputs);
                setOutputDevices(outputs);
                setSelectedInputId((prev) => prev || webrtcService.getInputDeviceId() || (inputs.length > 0 ? inputs[0].deviceId : ''));
                setSelectedOutputId((prev) => prev || webrtcService.getOutputDeviceId() || (outputs.length > 0 ? outputs[0].deviceId : ''));
            });
            void webrtcService.getVideoDevices().then((videos) => {
                setVideoDevices(videos);
                setSelectedVideoId((prev) => prev || (videos.length > 0 ? videos[0].deviceId : ''));
            });
        }
        else {
            setIsTestingMic(false);
            setMicLevel(0);
            setIsTestingCamera(false);
            setIsRecordingPttKey(false);
        }
    }, [isOpen]);
    useEffect(() => {
        if (isTestingMic) {
            const cleanup = webrtcService.testMicrophone((level) => {
                setMicLevel(level);
            }, loopbackEnabled);
            return () => {
                cleanup();
            };
        }
        else {
            setMicLevel(0);
            return undefined;
        }
    }, [isTestingMic]);
    const handleToggleLoopback = (enabled) => {
        setLoopbackEnabled(enabled);
        if (isTestingMic) {
            webrtcService.setTestMicLoopback(enabled);
        }
    };
    useEffect(() => {
        if (isTestingCamera && testVideoRef.current) {
            const cleanup = webrtcService.testCamera(testVideoRef.current);
            return () => {
                cleanup();
            };
        }
        return undefined;
    }, [isTestingCamera]);
    const handleVideoDeviceChange = async (deviceId) => {
        setSelectedVideoId(deviceId);
        await webrtcService.setVideoDevice(deviceId);
        if (isTestingCamera && testVideoRef.current) {
            setIsTestingCamera(false);
            setTimeout(() => setIsTestingCamera(true), 50);
        }
    };
    if (!isOpen)
        return null;
    const handleToggleSound = () => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        soundService.setEnabled(next);
        if (next)
            soundService.playNotification();
    };
    const handleToggleNotif = () => {
        const next = !notifEnabled;
        setNotifEnabled(next);
        try {
            localStorage.setItem('echo_notifications_enabled', String(next));
        }
        catch {
            // Ignore
        }
    };
    const handleToggleAutoStart = async () => {
        const next = !autoStartEnabled;
        setAutoStartEnabled(next);
        if (window.echoApi?.setLoginItemSettings) {
            await window.echoApi.setLoginItemSettings(next);
        }
    };
    const handleInputChange = (deviceId) => {
        setSelectedInputId(deviceId);
        void webrtcService.setInputDevice(deviceId);
    };
    const handleOutputChange = (deviceId) => {
        setSelectedOutputId(deviceId);
        void webrtcService.setOutputDevice(deviceId);
    };
    const handleVolumeChange = (volPercent) => {
        setOutputVolume(volPercent);
        webrtcService.setOutputVolume(volPercent / 100);
    };
    const handleTestSound = () => {
        soundService.playNotification();
    };
    const handleCheckUpdates = async () => {
        setIsCheckingUpdate(true);
        setUpdateStatus('Güncellemeler denetleniyor...');
        try {
            if (window.echoApi?.checkForUpdates) {
                await window.echoApi.checkForUpdates();
                setTimeout(() => {
                    setIsCheckingUpdate(false);
                    setUpdateStatus((prev) => prev === 'Güncellemeler denetleniyor...'
                        ? 'Echo güncel. En son sürümü kullanıyorsunuz.'
                        : prev);
                }, 2500);
            }
            else {
                setIsCheckingUpdate(false);
                setUpdateStatus('Geliştirici modunda güncelleme denetlenemez.');
            }
        }
        catch {
            setIsCheckingUpdate(false);
            setUpdateStatus('Güncelleme denetlenirken bir hata oluştu.');
        }
    };
    const handleOpenGithub = () => {
        if (window.echoApi?.openExternal) {
            void window.echoApi.openExternal('https://github.com/erdemyuksel4/Echo');
        }
        else {
            window.open('https://github.com/erdemyuksel4/Echo', '_blank');
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none animate-in fade-in duration-150", children: _jsxs("div", { className: "w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden", children: [_jsxs("div", { className: "border-b border-slate-800 bg-slate-950/80 px-6 pt-4 pb-0", children: [_jsxs("div", { className: "flex items-center justify-between pb-3", children: [_jsxs("div", { className: "flex items-center gap-2.5 text-white", children: [_jsx(Settings, { className: "h-5 w-5 text-indigo-400" }), _jsx("h2", { className: "text-base font-bold", children: "Ayarlar & Yap\u0131land\u0131rma" })] }), _jsx("button", { onClick: onClose, className: "rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition", children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "flex items-center gap-2 -mb-px", children: [_jsxs("button", { type: "button", onClick: () => setActiveTab('voice'), className: `flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition ${activeTab === 'voice'
                                        ? 'border-indigo-500 text-indigo-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'}`, children: [_jsx(Mic, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "Ses & G\u00F6r\u00FCnt\u00FC" })] }), _jsxs("button", { type: "button", onClick: () => setActiveTab('notifications'), className: `flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition ${activeTab === 'notifications'
                                        ? 'border-indigo-500 text-indigo-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'}`, children: [_jsx(Bell, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "Bildirim & Tercihler" })] }), _jsxs("button", { type: "button", onClick: () => setActiveTab('about'), className: `flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition ${activeTab === 'about'
                                        ? 'border-indigo-500 text-indigo-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'}`, children: [_jsx(Info, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "Hakk\u0131nda" })] })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-6", children: [activeTab === 'voice' && (_jsxs("div", { children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3", children: "Ses & Donan\u0131m Ayarlar\u0131" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400", children: _jsx(Mic, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "Giri\u015F Cihaz\u0131 (Mikrofon)" }), _jsx("p", { className: "text-xs text-slate-400", children: "Sesli sohbette kullan\u0131lacak mikrofon" })] })] }), _jsx("select", { value: selectedInputId, onChange: (e) => handleInputChange(e.target.value), className: "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none", children: inputDevices.length === 0 ? (_jsx("option", { value: "", children: "Varsay\u0131lan Sistem Mikrofonu" })) : (inputDevices.map((dev, idx) => (_jsx("option", { value: dev.deviceId, children: dev.label || `Mikrofon ${idx + 1}` }, dev.deviceId || idx)))) }), _jsxs("div", { className: "pt-2 space-y-3 border-t border-slate-800/80", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-semibold text-white", children: "Mikrofon Testi & Ses Yans\u0131tma" }), _jsx("p", { className: "text-[11px] text-slate-400", children: "Sesinizi konu\u015Farak test edin ve g\u00FCr\u00FClt\u00FC engellemenin etkisini duyun" })] }), _jsx("button", { type: "button", onClick: () => setIsTestingMic(!isTestingMic), className: `flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition ${isTestingMic
                                                                        ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/20'
                                                                        : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'}`, children: isTestingMic ? (_jsxs(_Fragment, { children: [_jsx(Square, { className: "h-3.5 w-3.5 fill-current" }), _jsx("span", { children: "Testi Durdur" })] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { className: "h-3.5 w-3.5 fill-current" }), _jsx("span", { children: "Mikrofonu Test Et" })] })) })] }), _jsx("div", { className: "space-y-1", children: _jsx("div", { className: "h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5", children: _jsx("div", { className: `h-full rounded-full transition-all duration-75 ${micLevel > 0.6
                                                                        ? 'bg-rose-500'
                                                                        : micLevel > 0.2
                                                                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                                                            : 'bg-slate-600'}`, style: { width: `${Math.min(100, Math.round(micLevel * 100))}%` } }) }) }), _jsxs("div", { className: "flex items-center justify-between rounded-lg bg-slate-900/50 border border-slate-800/80 px-3 py-2", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(Headphones, { className: "h-4 w-4 text-indigo-400" }), _jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-slate-200", children: "Sesimi Bana Yans\u0131t (Kulakl\u0131kta Dinle)" }), _jsx("div", { className: "text-[10px] text-slate-400", children: "Mikrofona konu\u015Ftu\u011Funuzda filtrelenmi\u015F sesiniz an\u0131nda kulakl\u0131\u011F\u0131n\u0131za yans\u0131t\u0131l\u0131r" })] })] }), _jsx("button", { type: "button", onClick: () => handleToggleLoopback(!loopbackEnabled), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${loopbackEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${loopbackEnabled ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg bg-amber-950/20 border border-amber-500/30 p-3", children: [_jsxs("div", { className: "flex items-center gap-2.5 pr-2", children: [_jsx(Radio, { className: `h-4 w-4 shrink-0 ${isSelfLoopbackActive ? 'text-amber-400 animate-pulse' : 'text-amber-500'}` }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs font-semibold text-white", children: "Kanal \u0130\u00E7i Ses & A\u011F Test Modu" }), isSelfLoopbackActive && (_jsx("span", { className: "rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/30", children: "A\u00C7IK" }))] }), _jsx("div", { className: "text-[11px] text-slate-400 mt-0.5", children: "Kanala kat\u0131ld\u0131\u011F\u0131n\u0131zda sesinizi ger\u00E7ek WebRTC a\u011F\u0131 ve Opus kodekinden ge\u00E7irerek size yans\u0131t\u0131r. Arkada\u015F\u0131n\u0131za ihtiya\u00E7 duymadan g\u00FCr\u00FClt\u00FC filtresini test edebilirsiniz." })] })] }), _jsx("button", { type: "button", onClick: () => webrtcService.toggleSelfLoopback(), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${isSelfLoopbackActive ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSelfLoopbackActive ? 'translate-x-6' : 'translate-x-1'}` }) })] }), isTestingMic && (_jsxs("div", { className: "rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-2.5 text-[11px] text-emerald-300 flex items-start gap-2", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-emerald-400 animate-pulse mt-1 shrink-0" }), _jsxs("div", { children: [_jsx("strong", { children: "Canl\u0131 Ses Testi Aktif:" }), " ", loopbackEnabled ? 'Mikrofona konuşun; arka plan uğultularının ve klavye seslerinin aşağıdaki filtreler tarafından nasıl kesildiğini kendi kulaklığınızdan dinleyebilirsiniz.' : 'Mikrofon seviyesi yeşil barda gösterilmektedir (ses yansıtma kapalı).'] })] }))] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400", children: _jsx(Sparkles, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "Geli\u015Fmi\u015F Ses \u0130\u015Fleme & G\u00FCr\u00FClt\u00FC Engelleme" }), _jsx("span", { className: "inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20", children: "0 ms Gecikme" })] }), _jsx("p", { className: "text-xs text-slate-400", children: "Chromium WebRTC DSP donan\u0131msal filtreleriyle kristal netli\u011Finde ses iletimi" })] })] }), _jsxs("div", { className: "space-y-3 pt-1", children: [_jsx("div", { className: "relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/60 border border-emerald-500/40 p-3.5 shadow-lg shadow-emerald-950/20", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "pr-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "text-xs font-bold text-white tracking-wide", children: "Yapay Zeka Destekli G\u00FCr\u00FClt\u00FC Engelleme (RNNoise - Standart / Derin \u00D6\u011Frenme)" }), _jsxs("span", { className: "relative flex h-2 w-2", children: [_jsx("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" }), _jsx("span", { className: "relative inline-flex rounded-full h-2 w-2 bg-emerald-500" })] }), _jsx("span", { className: "inline-flex items-center rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30", children: "YAPAY ZEKA" })] }), _jsx("div", { className: "text-[11px] text-slate-300 mt-0.5", children: "Klavye vuru\u015Flar\u0131n\u0131, fare t\u0131klamalar\u0131n\u0131 ve arka plandaki t\u00FCm sesleri yapay zeka ile s\u0131f\u0131rlar." })] }), _jsx("button", { type: "button", onClick: () => handleAudioProcessingToggle('rnnoise'), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${audioProcessing.rnnoise ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${audioProcessing.rnnoise ? 'translate-x-6' : 'translate-x-1'}` }) })] }) }), _jsxs("div", { className: "flex items-center justify-between rounded-lg bg-slate-900/60 border border-slate-800/80 p-3", children: [_jsxs("div", { className: "pr-4", children: [_jsx("div", { className: "text-xs font-semibold text-white", children: "G\u00FCr\u00FClt\u00FC Engelleme" }), _jsx("div", { className: "text-[11px] text-slate-400", children: "Fan, klima ve oda arka plan u\u011Fultular\u0131n\u0131 filtreler" })] }), _jsx("button", { type: "button", onClick: () => handleAudioProcessingToggle('noiseSuppression'), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${audioProcessing.noiseSuppression ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${audioProcessing.noiseSuppression ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg bg-slate-900/60 border border-slate-800/80 p-3", children: [_jsxs("div", { className: "pr-4", children: [_jsx("div", { className: "text-xs font-semibold text-white", children: "Klavye & T\u0131klama Filtresi" }), _jsx("div", { className: "text-[11px] text-slate-400", children: "Mekanik klavye tu\u015F vuru\u015Flar\u0131n\u0131 ve fare t\u0131klamalar\u0131n\u0131 bast\u0131r\u0131r" })] }), _jsx("button", { type: "button", onClick: () => handleAudioProcessingToggle('typingSuppression'), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${audioProcessing.typingSuppression ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${audioProcessing.typingSuppression ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg bg-slate-900/60 border border-slate-800/80 p-3", children: [_jsxs("div", { className: "pr-4", children: [_jsx("div", { className: "text-xs font-semibold text-white", children: "Yank\u0131 Engelleme (Echo Cancellation)" }), _jsx("div", { className: "text-[11px] text-slate-400", children: "Hoparl\u00F6rden \u00E7\u0131kan sesin mikrofona geri sekip yank\u0131 yapmas\u0131n\u0131 \u00F6nler" })] }), _jsx("button", { type: "button", onClick: () => handleAudioProcessingToggle('echoCancellation'), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${audioProcessing.echoCancellation ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${audioProcessing.echoCancellation ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg bg-slate-900/60 border border-slate-800/80 p-3", children: [_jsxs("div", { className: "pr-4", children: [_jsx("div", { className: "text-xs font-semibold text-white", children: "Otomatik Kazan\u00E7 Denetimi (AGC)" }), _jsx("div", { className: "text-[11px] text-slate-400", children: "Mikrofon ses seviyenizi dengeler, ani ba\u011F\u0131rma ve patlamalar\u0131 yumu\u015Fat\u0131r" })] }), _jsx("button", { type: "button", onClick: () => handleAudioProcessingToggle('autoGainControl'), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${audioProcessing.autoGainControl ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${audioProcessing.autoGainControl ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg bg-slate-900/60 border border-slate-800/80 p-3", children: [_jsxs("div", { className: "pr-4", children: [_jsx("div", { className: "text-xs font-semibold text-white", children: "Y\u00FCksek Ge\u00E7iren U\u011Fultu Filtresi" }), _jsx("div", { className: "text-[11px] text-slate-400", children: "Masa titre\u015Fimleri, vantilat\u00F6r ve d\u00FC\u015F\u00FCk frekansl\u0131 dip g\u00FCr\u00FClt\u00FCleri keser" })] }), _jsx("button", { type: "button", onClick: () => handleAudioProcessingToggle('highpassFilter'), className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${audioProcessing.highpassFilter ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${audioProcessing.highpassFilter ? 'translate-x-6' : 'translate-x-1'}` }) })] })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20 text-purple-400", children: _jsx(Headphones, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "\u00C7\u0131k\u0131\u015F (Hoparl\u00F6r & Kulakl\u0131k)" }), _jsx("p", { className: "text-xs text-slate-400", children: "Gelen seslerin \u00E7al\u0131naca\u011F\u0131 \u00E7\u0131k\u0131\u015F d\u00FCzeyi" })] }), _jsxs("button", { type: "button", onClick: handleTestSound, className: "flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition", title: "Hoparl\u00F6r\u00FC test et", children: [_jsx(Play, { className: "h-3 w-3 text-purple-400" }), _jsx("span", { children: "Sesi Test Et" })] })] }), _jsx("select", { value: selectedOutputId, onChange: (e) => handleOutputChange(e.target.value), className: "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none", children: outputDevices.length === 0 ? (_jsx("option", { value: "", children: "Varsay\u0131lan Sistem Hoparl\u00F6r\u00FC" })) : (outputDevices.map((dev, idx) => (_jsx("option", { value: dev.deviceId, children: dev.label || `Hoparlör ${idx + 1}` }, dev.deviceId || idx)))) }), _jsxs("div", { className: "space-y-1 pt-1", children: [_jsxs("div", { className: "flex justify-between text-xs text-slate-400", children: [_jsx("span", { children: "Ses D\u00FCzeyi" }), _jsxs("span", { className: "font-mono text-slate-200 font-semibold", children: [outputVolume, "%"] })] }), _jsx("input", { type: "range", min: "0", max: "100", value: outputVolume, onChange: (e) => handleVolumeChange(Number(e.target.value)), className: "w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer" })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400", children: _jsx(Sliders, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "Ses \u0130letim Modu" }), _jsx("p", { className: "text-xs text-slate-400", children: "Sesinizin kanala nas\u0131l aktar\u0131laca\u011F\u0131n\u0131 se\u00E7in" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("button", { type: "button", onClick: () => {
                                                                setInputMode('vad');
                                                                webrtcService.setInputMode('vad');
                                                            }, className: `flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition ${inputMode === 'vad'
                                                                ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm shadow-indigo-500/10'
                                                                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-300'}`, children: [_jsx("span", { className: "text-xs font-bold", children: "Ses Etkinli\u011Fi (VAD)" }), _jsx("span", { className: "text-[11px] text-slate-400", children: "Konu\u015Ftu\u011Funuzda otomatik alg\u0131lan\u0131r" })] }), _jsxs("button", { type: "button", onClick: () => {
                                                                setInputMode('ptt');
                                                                webrtcService.setInputMode('ptt');
                                                            }, className: `flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition ${inputMode === 'ptt'
                                                                ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm shadow-indigo-500/10'
                                                                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-300'}`, children: [_jsx("span", { className: "text-xs font-bold", children: "Bas-Konu\u015F (Push-to-Talk)" }), _jsx("span", { className: "text-[11px] text-slate-400", children: "Belirlenen tu\u015Fa basarak konu\u015Fun" })] })] }), inputMode === 'ptt' && (_jsxs("div", { className: "pt-3 space-y-3 border-t border-slate-800/80 animate-in fade-in duration-150", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold text-white", children: "Bas-Konu\u015F Tu\u015Fu" }), _jsx("div", { className: "text-[11px] text-slate-400", children: "Konu\u015Fmak i\u00E7in bas\u0131l\u0131 tutaca\u011F\u0131n\u0131z tu\u015F" })] }), _jsxs("button", { type: "button", onClick: () => setIsRecordingPttKey(true), className: `flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-mono font-bold transition border ${isRecordingPttKey
                                                                        ? 'border-amber-500 bg-amber-500/20 text-amber-300 animate-pulse'
                                                                        : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-indigo-500 hover:bg-slate-750'}`, children: [_jsx(Keyboard, { className: "h-3.5 w-3.5 text-indigo-400" }), _jsx("span", { children: isRecordingPttKey ? 'Bir tuşa basın...' : pttKeyDisplay })] })] }), _jsxs("div", { className: "space-y-1 pt-1", children: [_jsxs("div", { className: "flex justify-between text-xs text-slate-400", children: [_jsx("span", { children: "B\u0131rakma Gecikmesi" }), _jsxs("span", { className: "font-mono text-slate-200 font-semibold", children: [pttReleaseDelay, " ms"] })] }), _jsx("input", { type: "range", min: "50", max: "1000", step: "50", value: pttReleaseDelay, onChange: (e) => setPttReleaseDelay(Number(e.target.value)), className: "w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer" }), _jsx("p", { className: "text-[10px] text-slate-500", children: "Tu\u015Fu b\u0131rakt\u0131ktan sonra sesinizin ani kesilmemesi i\u00E7in beklenen s\u00FCre." })] })] }))] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400", children: _jsx(Video, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "Kamera & Video" }), _jsx("p", { className: "text-xs text-slate-400", children: "Kamera ayg\u0131t\u0131n\u0131 se\u00E7in ve canl\u0131 ayna g\u00F6r\u00FCnt\u00FCn\u00FCz\u00FC test edin" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-medium text-slate-300", children: "Kamera Ayg\u0131t\u0131" }), videoDevices.length === 0 ? (_jsx("div", { className: "rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-500 italic", children: "Alg\u0131lanan kamera bulunamad\u0131" })) : (_jsx("select", { value: selectedVideoId, onChange: (e) => void handleVideoDeviceChange(e.target.value), className: "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none", children: videoDevices.map((dev, idx) => (_jsx("option", { value: dev.deviceId, children: dev.label || `Kamera ${idx + 1}` }, dev.deviceId || idx))) }))] }), _jsxs("div", { className: "space-y-2 pt-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-medium text-slate-300", children: "Kamera \u00D6nizleme & Ayna Testi" }), _jsx("button", { type: "button", onClick: () => setIsTestingCamera((prev) => !prev), className: `flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${isTestingCamera
                                                                        ? 'bg-rose-600 text-white hover:bg-rose-500'
                                                                        : 'bg-emerald-600 text-white hover:bg-emerald-500'}`, children: isTestingCamera ? (_jsxs(_Fragment, { children: [_jsx(Square, { className: "h-3 w-3 fill-current" }), _jsx("span", { children: "Testi Durdur" })] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { className: "h-3 w-3 fill-current" }), _jsx("span", { children: "Kameray\u0131 Test Et" })] })) })] }), isTestingCamera ? (_jsxs("div", { className: "relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/50 shadow-inner flex items-center justify-center", children: [_jsx("video", { ref: testVideoRef, autoPlay: true, playsInline: true, muted: true, className: "w-full h-full object-cover -scale-x-100" }), _jsxs("div", { className: "absolute top-2 left-2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded-md border border-emerald-500/30 text-[11px] font-medium text-emerald-400", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-emerald-400 animate-pulse" }), _jsx("span", { children: "Canl\u0131 \u00D6nizleme (480p24)" })] })] })) : (_jsx("div", { className: "rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-500", children: "G\u00F6r\u00FCnt\u00FCn\u00FCz\u00FC kontrol etmek i\u00E7in yukar\u0131daki \"Kameray\u0131 Test Et\" d\u00FC\u011Fmesine t\u0131klay\u0131n." }))] })] })] })] })), activeTab === 'notifications' && (_jsxs("div", { children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3", children: "Bildirim & Tercihler" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600/20 text-sky-400", children: _jsx(Laptop, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "Windows ile Birlikte Ba\u015Flat" }), _jsx("p", { className: "text-xs text-slate-400", children: "Bilgisayar a\u00E7\u0131ld\u0131\u011F\u0131nda Echo otomatik ba\u015Flas\u0131n" })] })] }), _jsx("button", { onClick: handleToggleAutoStart, className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoStartEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoStartEnabled ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400", children: _jsx(Volume2, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "Bildirim Sesleri" }), _jsx("p", { className: "text-xs text-slate-400", children: "Gelen mesajlar i\u00E7in sesli uyar\u0131 \u00E7al" })] })] }), _jsx("button", { onClick: handleToggleSound, className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400", children: _jsx(Bell, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "Masa\u00FCst\u00FC Bildirimleri" }), _jsx("p", { className: "text-xs text-slate-400", children: "Windows sistem bildirimleri g\u00F6nder" })] })] }), _jsx("button", { onClick: handleToggleNotif, className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifEnabled ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-400", children: [_jsx(Shield, { className: "h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsxs("span", { className: "font-semibold text-slate-300", children: ["Gizlilik & Sistem Tepsisi:", ' '] }), "Pencereyi kapatt\u0131\u011F\u0131n\u0131zda Echo arka planda sistem tepsisinde \u00E7al\u0131\u015Fmaya devam eder ve sesli ba\u011Flant\u0131n\u0131z\u0131 koparmadan arka planda tutar."] })] })] })] })), activeTab === 'about' && (_jsxs("div", { className: "space-y-5 animate-in fade-in duration-150", children: [_jsx("div", { className: "relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-950 p-5 shadow-lg", children: _jsxs("div", { className: "relative z-10 flex items-center gap-4", children: [_jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xl shadow-indigo-600/30 ring-2 ring-indigo-400/20", children: _jsx(Sparkles, { className: "h-7 w-7" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "text-lg font-black tracking-tight text-white", children: "Echo" }), _jsxs("span", { className: "rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-mono font-bold text-indigo-300 border border-indigo-500/30", children: ["v", appInfo?.appVersion || '0.1.0'] }), _jsxs("span", { className: "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 flex items-center gap-1", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" }), "Canl\u0131"] })] }), _jsx("p", { className: "text-xs text-slate-400 mt-1 line-clamp-2", children: "G\u00FCvenli, hafif, modern ve P2P mesh mimarili yeni nesil sesli/yaz\u0131l\u0131 ileti\u015Fim platformu." })] })] }) }), _jsxs("div", { children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5", children: "S\u00FCr\u00FCm & \u00C7al\u0131\u015Fma Ortam\u0131" }), _jsxs("div", { className: "grid grid-cols-2 gap-2.5", children: [_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1", children: [_jsxs("div", { className: "text-[10px] font-medium text-slate-400 flex items-center gap-1.5", children: [_jsx(Layers, { className: "h-3 w-3 text-indigo-400" }), _jsx("span", { children: "Protokol S\u00FCr\u00FCm\u00FC" })] }), _jsxs("div", { className: "font-mono text-xs font-bold text-white", children: ["Echo Protocol v", appInfo?.protocolVersion || 1] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1", children: [_jsxs("div", { className: "text-[10px] font-medium text-slate-400 flex items-center gap-1.5", children: [_jsx(Cpu, { className: "h-3 w-3 text-emerald-400" }), _jsx("span", { children: "\u0130\u015Fletim Sistemi & Mimari" })] }), _jsxs("div", { className: "font-mono text-xs font-bold text-white capitalize", children: [appInfo?.platform || 'Windows', " (", appInfo?.arch || 'x64', ")"] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1", children: [_jsx("div", { className: "text-[10px] font-medium text-slate-400", children: "Electron \u00C7ekirde\u011Fi" }), _jsxs("div", { className: "font-mono text-xs font-bold text-slate-200", children: ["v", appInfo?.electronVersion || '34.x'] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1", children: [_jsx("div", { className: "text-[10px] font-medium text-slate-400", children: "Chromium & Node.js" }), _jsxs("div", { className: "font-mono text-xs font-bold text-slate-200 truncate", children: ["Chrome ", appInfo?.chromeVersion?.split('.')[0] || '132', " / Node", ' ', appInfo?.nodeVersion || '20.x'] })] })] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5", children: "Mimari & G\u00FCvenlik" }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { className: "flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3", children: [_jsx(ShieldCheck, { className: "h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-slate-200", children: "Ed25519 Kimlik" }), _jsx("div", { className: "text-[11px] text-slate-400 mt-0.5", children: "\u015Eifre yok, cihazda \u015Fifrelenen \u00F6zel anahtar." })] })] }), _jsxs("div", { className: "flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3", children: [_jsx(Radio, { className: "h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-slate-200", children: "P2P WebRTC Mesh" }), _jsx("div", { className: "text-[11px] text-slate-400 mt-0.5", children: "E\u015Fler aras\u0131 do\u011Frudan \u015Fifreli ses & g\u00F6r\u00FCnt\u00FC." })] })] }), _jsxs("div", { className: "flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3", children: [_jsx(CheckCircle2, { className: "h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-slate-200", children: "S\u0131f\u0131r Telemetri" }), _jsx("div", { className: "text-[11px] text-slate-400 mt-0.5", children: "Hi\u00E7bir kullan\u0131c\u0131 takibi ve reklam i\u00E7ermez." })] })] }), _jsxs("div", { className: "flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3", children: [_jsx(Layers, { className: "h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-slate-200", children: "Cloudflare DO" }), _jsx("div", { className: "text-[11px] text-slate-400 mt-0.5", children: "Sunucusuz SQLite & WebSocket Hibernation." })] })] })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-white", children: "Yaz\u0131l\u0131m G\u00FCncellemeleri" }), _jsx("p", { className: "text-xs text-slate-400", children: "Otomatik arka plan g\u00FCncellemeleri" })] }), _jsxs("button", { type: "button", disabled: isCheckingUpdate, onClick: handleCheckUpdates, className: "flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition", children: [_jsx(RefreshCw, { className: `h-3.5 w-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}` }), _jsx("span", { children: isCheckingUpdate ? 'Denetleniyor...' : 'Güncellemeleri Denetle' })] })] }), updateStatus && (_jsxs("div", { className: "rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-xs text-slate-300 flex items-center gap-2", children: [_jsx(Info, { className: "h-4 w-4 text-indigo-400 flex-shrink-0" }), _jsx("span", { children: updateStatus })] }))] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs", children: [_jsx("div", { className: "text-slate-400", children: "Echo a\u00E7\u0131k kaynakl\u0131 bir yaz\u0131l\u0131md\u0131r (MIT Lisans\u0131)." }), _jsxs("button", { type: "button", onClick: handleOpenGithub, className: "flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition font-medium", children: [_jsx("span", { children: "GitHub" }), _jsx(ExternalLink, { className: "h-3 w-3" })] })] })] }))] }), _jsx("div", { className: "flex justify-end border-t border-slate-800 bg-slate-950/60 px-6 py-3", children: _jsx("button", { onClick: onClose, className: "rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition", children: "Tamam" }) })] }) }));
};
