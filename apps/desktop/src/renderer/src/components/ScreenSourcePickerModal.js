import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Monitor, AppWindow, Volume2, AlertTriangle, X, Play, RefreshCw } from 'lucide-react';
import { screenCaptureService } from '../services/screenShare/screenCaptureService';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { useVoiceStore } from '../stores/useVoiceStore';
export const ScreenSourcePickerModal = ({ isOpen, onClose, }) => {
    const { currentChannelId } = useVoiceStore();
    const { startSharing } = useScreenShareStore();
    const [activeTab, setActiveTab] = useState('screen');
    const [sources, setSources] = useState([]);
    const [selectedSourceId, setSelectedSourceId] = useState(null);
    const [quality, setQuality] = useState('720p30');
    const [mode, setMode] = useState('motion');
    const [hasAudio, setHasAudio] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const loadSources = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            if (window.echoApi?.getDesktopSources) {
                const list = await window.echoApi.getDesktopSources();
                setSources(list);
                if (list.length > 0 && !selectedSourceId) {
                    setSelectedSourceId(list[0].id);
                }
            }
        }
        catch (err) {
            console.error('Failed to load screen sources:', err);
            setErrorMsg('Kaynaklar yüklenirken bir hata oluştu.');
        }
        finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        if (isOpen) {
            void loadSources();
        }
        else {
            setSelectedSourceId(null);
            setErrorMsg(null);
        }
    }, [isOpen]);
    if (!isOpen)
        return null;
    const screenSources = sources.filter((s) => s.isScreen);
    const windowSources = sources.filter((s) => !s.isScreen);
    const displayedSources = activeTab === 'screen' ? screenSources : windowSources;
    const handleStart = async () => {
        if (!selectedSourceId || !currentChannelId)
            return;
        setIsCapturing(true);
        setErrorMsg(null);
        try {
            const stream = await screenCaptureService.captureScreen({
                sourceId: selectedSourceId,
                quality,
                mode,
                hasAudio,
            });
            // Handle stream ended by OS/user
            stream.getVideoTracks()[0]?.addEventListener('ended', () => {
                void useScreenShareStore.getState().stopSharing(currentChannelId);
            });
            await startSharing(currentChannelId, stream, quality, mode, hasAudio);
            onClose();
        }
        catch (err) {
            console.error('Failed to start screen capture:', err);
            setErrorMsg('Ekran yakalama başlatılamadı. İzinleri kontrol edin.');
        }
        finally {
            setIsCapturing(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150", children: _jsxs("div", { className: "relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-800 px-6 py-4", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400", children: _jsx(Monitor, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-base font-bold text-white", children: "Ekran\u0131n\u0131 Payla\u015F" }), _jsx("p", { className: "text-xs text-slate-400", children: "Ses kanal\u0131ndaki arkada\u015Flar\u0131na ekran\u0131n\u0131 veya bir uygulamay\u0131 g\u00F6ster" })] })] }), _jsx("button", { onClick: onClose, className: "rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition", children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "flex border-b border-slate-800 px-6 pt-3", children: [_jsxs("button", { onClick: () => {
                                setActiveTab('screen');
                                if (screenSources.length > 0)
                                    setSelectedSourceId(screenSources[0].id);
                            }, className: `flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${activeTab === 'screen'
                                ? 'border-indigo-500 text-white'
                                : 'border-transparent text-slate-400 hover:text-slate-200'}`, children: [_jsx(Monitor, { className: "h-4 w-4" }), _jsxs("span", { children: ["T\u00FCm Ekranlar (", screenSources.length, ")"] })] }), _jsxs("button", { onClick: () => {
                                setActiveTab('window');
                                if (windowSources.length > 0)
                                    setSelectedSourceId(windowSources[0].id);
                            }, className: `flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${activeTab === 'window'
                                ? 'border-indigo-500 text-white'
                                : 'border-transparent text-slate-400 hover:text-slate-200'}`, children: [_jsx(AppWindow, { className: "h-4 w-4" }), _jsxs("span", { children: ["Uygulama Pencereleri (", windowSources.length, ")"] })] }), _jsxs("button", { onClick: () => void loadSources(), className: "ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 py-2.5 transition", title: "Kaynaklar\u0131 Yenile", children: [_jsx(RefreshCw, { className: `h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}` }), _jsx("span", { children: "Yenile" })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-6 max-h-64", children: displayedSources.length === 0 ? (_jsx("div", { className: "flex h-36 flex-col items-center justify-center text-center text-slate-500", children: _jsx("p", { className: "text-xs", children: "Payla\u015F\u0131labilir kaynak bulunamad\u0131." }) })) : (_jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-3", children: displayedSources.map((source) => {
                            const isSelected = selectedSourceId === source.id;
                            return (_jsxs("button", { onClick: () => setSelectedSourceId(source.id), className: `group relative flex flex-col items-center rounded-xl border p-2 text-left transition overflow-hidden ${isSelected
                                    ? 'border-indigo-500 bg-indigo-600/10 ring-2 ring-indigo-500/40'
                                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/40'}`, children: [_jsx("div", { className: "relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800/60 flex items-center justify-center mb-2", children: source.thumbnailDataUrl ? (_jsx("img", { src: source.thumbnailDataUrl, alt: source.name, className: "h-full w-full object-contain" })) : (_jsx(Monitor, { className: "h-8 w-8 text-slate-700" })) }), _jsxs("div", { className: "w-full flex items-center gap-1.5 px-1", children: [source.appIconDataUrl && (_jsx("img", { src: source.appIconDataUrl, alt: "", className: "h-3.5 w-3.5 flex-shrink-0" })), _jsx("span", { className: "truncate text-xs font-medium text-slate-200", children: source.name })] })] }, source.id));
                        }) })) }), _jsxs("div", { className: "border-t border-slate-800/80 bg-slate-950/40 p-5 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5", children: "Yay\u0131n Kalitesi" }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: ['720p30', '1080p30', '1080p60'].map((q) => (_jsx("button", { type: "button", onClick: () => setQuality(q), className: `rounded-lg py-1.5 text-xs font-semibold transition border ${quality === q
                                                    ? 'border-indigo-500 bg-indigo-600 text-white'
                                                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'}`, children: q === '720p30'
                                                    ? '720p 30fps'
                                                    : q === '1080p30'
                                                        ? '1080p 30fps'
                                                        : '1080p 60fps' }, q))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5", children: "Optimize Et" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("button", { type: "button", onClick: () => setMode('motion'), className: `rounded-lg py-1.5 text-xs font-semibold transition border ${mode === 'motion'
                                                        ? 'border-indigo-500 bg-indigo-600 text-white'
                                                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'}`, children: "Ak\u0131c\u0131 (Oyun & Video)" }), _jsx("button", { type: "button", onClick: () => setMode('detail'), className: `rounded-lg py-1.5 text-xs font-semibold transition border ${mode === 'detail'
                                                        ? 'border-indigo-500 bg-indigo-600 text-white'
                                                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'}`, children: "Netlik (Metin & Kod)" })] })] })] }), _jsxs("div", { className: "flex flex-col gap-2 pt-1", children: [quality === '1080p60' && (_jsxs("div", { className: "flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-300", children: [_jsx(AlertTriangle, { className: "h-4 w-4 flex-shrink-0 text-amber-400" }), _jsx("span", { children: "1080p 60fps y\u00FCksek bilgisayar performans\u0131 ve y\u00FCkleme (upload) h\u0131z\u0131 gerektirir." })] })), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none", children: [_jsx("input", { type: "checkbox", checked: hasAudio, onChange: (e) => setHasAudio(e.target.checked), className: "h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500" }), _jsx(Volume2, { className: "h-4 w-4 text-indigo-400" }), _jsx("span", { children: "Sistem sesini de payla\u015F (Oyun ve m\u00FCzik sesi)" })] }), hasAudio && activeTab === 'screen' && (_jsxs("div", { className: "flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300", children: [_jsx(AlertTriangle, { className: "h-4 w-4 flex-shrink-0 text-amber-400 mt-0.5" }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "font-semibold text-amber-200", children: "Sistem Sesi & Yank\u0131 Bilgilendirmesi" }), _jsxs("p", { className: "text-amber-300/90 leading-relaxed", children: ["T\u00FCm masa\u00FCst\u00FC payla\u015F\u0131ld\u0131\u011F\u0131nda sistem sesine sesli sohbet sesleri kar\u0131\u015Fabilir; yaln\u0131zca oyun/uygulama sesini payla\u015Fmak i\u00E7in ", _jsx("strong", { children: "Pencere" }), " sekmesinden oyunu se\u00E7meniz \u00F6nerilir."] }), _jsx("button", { type: "button", onClick: () => {
                                                        setActiveTab('window');
                                                        if (windowSources.length > 0)
                                                            setSelectedSourceId(windowSources[0].id);
                                                    }, className: "mt-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer", children: "Pencere sekmesine ge\u00E7 \u2192" })] })] })), hasAudio && activeTab === 'window' && (_jsxs("div", { className: "flex items-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-2.5 text-xs text-indigo-300", children: [_jsx(Volume2, { className: "h-4 w-4 flex-shrink-0 text-indigo-400" }), _jsx("span", { children: "Echo ak\u0131ll\u0131 yank\u0131 \u00F6nleyici ve ses ducking sistemi, ses kanal\u0131ndaki arkada\u015Flar\u0131n\u0131z konu\u015Ftu\u011Funda yay\u0131n sesini otomatik dengeleyerek yank\u0131y\u0131 \u00F6nler." })] }))] }), errorMsg && (_jsx("div", { className: "rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300", children: errorMsg }))] }), _jsxs("div", { className: "flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950/80", children: [_jsx("div", { className: "text-[11px] text-slate-500", children: activeTab === 'window' && 'Oyun paylaşıyorsanız Tüm Ekran seçmeniz önerilir.' }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition", children: "\u0130ptal" }), _jsxs("button", { type: "button", disabled: !selectedSourceId || isCapturing, onClick: () => void handleStart(), className: "flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition disabled:opacity-40", children: [_jsx(Play, { className: "h-3.5 w-3.5 fill-current" }), _jsx("span", { children: isCapturing ? 'Başlatılıyor...' : 'Yayını Başlat' })] })] })] })] }) }));
};
