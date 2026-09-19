import React, { useEffect, useState } from 'react';
import {
  APP_NAME,
  PROTOCOL_VERSION,
  HealthResponseSchema,
  type HealthResponse,
} from '@echo/shared';

interface SystemInfo {
  appName: string;
  protocolVersion: number;
  appVersion: string;
  platform: string;
}

export const App: React.FC = () => {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [serverHealth, setServerHealth] = useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    if (window.echoApi?.getAppInfo) {
      window.echoApi.getAppInfo().then(setSysInfo).catch(console.error);
    }
  }, []);

  const checkServerHealth = async (): Promise<void> => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const res = await fetch('http://localhost:8787/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const parsed = HealthResponseSchema.parse(data);
      setServerHealth(parsed);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Bağlantı kurulamadı');
      setServerHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-900 px-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Merhaba {APP_NAME}</h1>
          <p className="mt-1 text-sm text-slate-400">Faz 0 — Monorepo İskeleti Çalışıyor</p>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Paket Bilgileri (Shared &amp; Desktop)
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Protokol Sürümü:</span>
              <span className="font-mono text-indigo-400">v{PROTOCOL_VERSION}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Masaüstü Platformu:</span>
              <span className="font-mono text-emerald-400">
                {sysInfo?.platform ?? 'Yükleniyor...'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Güvenlik Durumu:</span>
              <span className="font-mono text-emerald-400">Sandbox &amp; İzole</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">
                Sunucu Durumu (Worker)
              </span>
              <button
                onClick={checkServerHealth}
                disabled={loadingHealth}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {loadingHealth ? 'Kontrol ediliyor...' : 'Test Et'}
              </button>
            </div>

            {serverHealth && (
              <div className="space-y-1 text-emerald-400">
                <div>Durum: {serverHealth.status.toUpperCase()}</div>
                <div>
                  Uygulama: {serverHealth.app} (v{serverHealth.version})
                </div>
                <div>Protokol: v{serverHealth.protocolVersion}</div>
              </div>
            )}

            {healthError && (
              <div className="text-rose-400">
                Hata: {healthError}
                <div className="text-[10px] text-slate-500 mt-1">
                  (Sunucuyu başlatmak için: pnpm --filter @echo/server dev)
                </div>
              </div>
            )}

            {!serverHealth && !healthError && !loadingHealth && (
              <div className="text-slate-500">
                Sunucu bağlantısını doğrulamak için &quot;Test Et&quot; butonuna tıklayın.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
