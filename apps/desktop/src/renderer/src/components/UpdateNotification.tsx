import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Sparkles, X, CheckCircle2 } from 'lucide-react';

type UpdateStatus = 'idle' | 'available' | 'downloading' | 'downloaded';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export const UpdateNotification: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress>({ percent: 0, bytesPerSecond: 0 });
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!window.echoApi) return;

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
    return (
      <button
        onClick={handleInstall}
        title="Echo güncellemesi hazır. Yeniden başlatmak için tıkla."
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all cursor-pointer animate-pulse"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Güncelleme Hazır (v{updateInfo?.version})</span>
      </button>
    );
  }

  if (isDismissed) {
    return null;
  }

  return (
    <div className="relative z-40 w-full shrink-0 border-b border-slate-800/80 bg-slate-950/95 px-4 py-2.5 backdrop-blur shadow-md select-none transition-all">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left Side: Status & Message */}
        <div className="flex items-center gap-3 min-w-0">
          {status === 'available' && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="h-4 w-4" />
            </div>
          )}

          {status === 'downloading' && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Download className="h-4 w-4 animate-bounce" />
            </div>
          )}

          {status === 'downloaded' && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-100">
              {status === 'available' && `Yeni Echo sürümü indiriliyor: v${updateInfo?.version ?? ''}`}
              {status === 'downloading' && `Echo Güncelleniyor... %${progress.percent}`}
              {status === 'downloaded' && 'Echo Güncellendi! Yeniden başlatılıyor...'}
            </span>

            {status === 'available' && (
              <span className="text-[11px] text-slate-400 truncate">
                Güncelleme otomatik olarak kurulacak.
              </span>
            )}

            {status === 'downloading' && (
              <span className="text-[11px] text-slate-400">
                {progress.bytesPerSecond > 0 && `(${formatSpeed(progress.bytesPerSecond)})`}
              </span>
            )}

            {status === 'downloaded' && (
              <span className="text-[11px] text-slate-400 truncate">
                Uygulama otomatik olarak yeniden açılacak.
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Progress Bar / Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {status === 'downloading' && (
            <div className="w-32 sm:w-44 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
              />
            </div>
          )}

          {status === 'downloaded' && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Yeniden başlatılıyor...</span>
            </div>
          )}

          <button
            onClick={() => setIsDismissed(true)}
            title="Kapat"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
