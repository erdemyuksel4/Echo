import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Download, RefreshCw, Sparkles, X, CheckCircle2 } from 'lucide-react';
function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0)
        return '';
    if (bytesPerSec < 1024 * 1024) {
        return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    }
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}
export const UpdateNotification = () => {
    const [status, setStatus] = useState('idle');
    const [updateInfo, setUpdateInfo] = useState(null);
    const [progress, setProgress] = useState({ percent: 0, bytesPerSecond: 0 });
    const [isDismissed, setIsDismissed] = useState(false);
    useEffect(() => {
        if (!window.echoApi)
            return;
        const unsubAvailable = window.echoApi.onUpdateAvailable((info) => {
            setUpdateInfo(info);
            setStatus('available');
            setIsDismissed(false);
        });
        const unsubProgress = window.echoApi.onUpdateProgress((prog) => {
            setStatus('downloading');
            setProgress(prog);
        });
        const unsubDownloaded = window.echoApi.onUpdateDownloaded((info) => {
            setStatus('downloaded');
            setUpdateInfo((prev) => ({
                version: info.version,
                releaseNotes: prev?.releaseNotes,
            }));
            setIsDismissed(false);
        });
        return () => {
            unsubAvailable();
            unsubProgress();
            unsubDownloaded();
        };
    }, []);
    const handleInstall = () => {
        window.echoApi.quitAndInstall();
    };
    if (status === 'idle') {
        return null;
    }
    // Floating button if user dismissed the full banner but update is downloaded and ready
    if (isDismissed && status === 'downloaded') {
        return (_jsxs("button", { onClick: handleInstall, title: "Echo g\u00FCncellemesi haz\u0131r. Yeniden ba\u015Flatmak i\u00E7in t\u0131kla.", className: "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all cursor-pointer animate-pulse", children: [_jsx(RefreshCw, { className: "h-3.5 w-3.5" }), _jsxs("span", { children: ["G\u00FCncelleme Haz\u0131r (v", updateInfo?.version, ")"] })] }));
    }
    if (isDismissed) {
        return null;
    }
    return (_jsx("div", { className: "relative z-40 w-full shrink-0 border-b border-slate-800/80 bg-slate-950/95 px-4 py-2.5 backdrop-blur shadow-md select-none transition-all", children: _jsxs("div", { className: "flex items-center justify-between gap-4 max-w-7xl mx-auto", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [status === 'available' && (_jsx("div", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30", children: _jsx(Sparkles, { className: "h-4 w-4" }) })), status === 'downloading' && (_jsx("div", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30", children: _jsx(Download, { className: "h-4 w-4 animate-bounce" }) })), status === 'downloaded' && (_jsx("div", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30", children: _jsx(CheckCircle2, { className: "h-4 w-4" }) })), _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-100", children: [status === 'available' &&
                                            `Yeni Echo sürümü indiriliyor: v${updateInfo?.version ?? ''}`, status === 'downloading' && `Echo Güncelleniyor... %${progress.percent}`, status === 'downloaded' && 'Echo Güncellendi! Yeniden başlatılıyor...'] }), status === 'available' && (_jsx("span", { className: "text-[11px] text-slate-400 truncate", children: "G\u00FCncelleme otomatik olarak kurulacak." })), status === 'downloading' && (_jsx("span", { className: "text-[11px] text-slate-400", children: progress.bytesPerSecond > 0 && `(${formatSpeed(progress.bytesPerSecond)})` })), status === 'downloaded' && (_jsx("span", { className: "text-[11px] text-slate-400 truncate", children: "Uygulama otomatik olarak yeniden a\u00E7\u0131lacak." }))] })] }), _jsxs("div", { className: "flex items-center gap-3 shrink-0", children: [status === 'downloading' && (_jsx("div", { className: "w-32 sm:w-44 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50", children: _jsx("div", { className: "h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300 rounded-full", style: { width: `${Math.min(100, Math.max(0, progress.percent))}%` } }) })), status === 'downloaded' && (_jsxs("div", { className: "flex items-center gap-2 text-xs font-medium text-emerald-400", children: [_jsx(RefreshCw, { className: "h-3.5 w-3.5 animate-spin" }), _jsx("span", { children: "Yeniden ba\u015Flat\u0131l\u0131yor..." })] })), _jsx("button", { onClick: () => setIsDismissed(true), title: "Kapat", className: "rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer", children: _jsx(X, { className: "h-4 w-4" }) })] })] }) }));
};
