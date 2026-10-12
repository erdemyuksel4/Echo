import React, { useState, useEffect, useRef } from 'react';
import { QrCode, UserPlus, Copy, Check, RefreshCw, Smartphone, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { deviceLinkService, type DeviceLinkInitResult } from '../services/deviceLinkService';
import type { DeviceLinkSessionState } from '@echo/shared';

const COLOR_PALETTE = [
  '#4f46e5', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Rose
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

export const OnboardingModal: React.FC = () => {
  const { createIdentity } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'create' | 'link'>('create');

  // Create Identity State
  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0] ?? '#4f46e5');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Device Link State
  const [linkSession, setLinkSession] = useState<DeviceLinkInitResult | null>(null);
  const [linkState, setLinkState] = useState<DeviceLinkSessionState | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize device link session
  const startLinkSession = async () => {
    setLinkLoading(true);
    setLinkError(null);
    setLinkState(null);
    try {
      const session = await deviceLinkService.initSession();
      setLinkSession(session);
      setTimeLeft(Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)));
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Eşleme oturumu başlatılamadı');
    } finally {
      setLinkLoading(false);
    }
  };

  // Switch to link tab triggers session
  useEffect(() => {
    if (activeTab === 'link' && !linkSession) {
      void startLinkSession();
    }
  }, [activeTab]);

  // Polling loop for device link status
  useEffect(() => {
    if (activeTab !== 'link' || !linkSession) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    // Countdown timer
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Status polling
    pollIntervalRef.current = setInterval(async () => {
      try {
        const state = await deviceLinkService.pollStatus(linkSession.sessionId);
        setLinkState(state);

        if (state.status === 'approved') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          // Transfer identity
          await deviceLinkService.completeTransfer(state, linkSession.keypair);
        } else if (state.status === 'rejected' || state.status === 'expired') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
      } catch {
        // network tick error, retry next time
      }
    }, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeTab, linkSession]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      setCreateError('Görünen ad 2 ile 32 karakter arasında olmalıdır.');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      await createIdentity(trimmed, selectedColor);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Profil oluşturulamadı');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!linkSession?.linkCode) return;
    navigator.clipboard.writeText(linkSession.linkCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* Tab Selection */}
        <div className="flex rounded-xl bg-slate-950/80 p-1 mb-6 border border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Yeni Hesap Aç
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'link'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Cihaz Eşle (QR / Kod)
          </button>
        </div>

        {activeTab === 'create' ? (
          <div>
            <div className="text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg transition-colors"
                style={{ backgroundColor: selectedColor }}
              >
                {displayName.trim() ? displayName.trim().charAt(0).toUpperCase() : 'E'}
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">Echo&apos;ya Hoş Geldiniz</h2>
              <p className="mt-1 text-xs text-slate-400">
                Kullanıcı adı ve avatar renginizi seçerek hemen başlayın.
              </p>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Görünen Ad
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Örn: Erdem"
                  maxLength={32}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Avatar Rengi
                </label>
                <div className="flex gap-2 justify-center">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`h-8 w-8 rounded-full transition-transform ${
                        selectedColor === color
                          ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Privacy Notice Required by Architecture Doc */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
                <span className="font-semibold text-amber-300">Gizlilik Notu: </span>
                Ses ve ekran akışları WebRTC (DTLS-SRTP) ile uçtan uca şifreli iletilir. Yazılı mesajlar
                ve grup verileri Cloudflare sunucusunda düz metin olarak saklanır.
              </div>

              {createError && <div className="text-xs text-rose-400 text-center">{createError}</div>}

              <button
                type="submit"
                disabled={createLoading || !displayName.trim()}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {createLoading ? 'Oluşturuluyor...' : 'Hesap Oluştur ve Başla'}
              </button>
            </form>
          </div>
        ) : (
          /* Device Link (QR & Code) Tab */
          <div className="text-center">
            <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-400" />
              Diğer Cihazınızla Giriş Yapın
            </h2>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Zaten giriş yapmış olduğunuz bilgisayar veya telefondan{' '}
              <span className="text-indigo-300 font-medium">Ayarlar &gt; Cihaz Eşle</span> bölümüne gidin.
            </p>

            {linkLoading ? (
              <div className="my-8 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-xs text-slate-400">Güvenli oturum oluşturuluyor...</span>
              </div>
            ) : linkError ? (
              <div className="my-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300">
                <p className="mb-3">{linkError}</p>
                <button
                  type="button"
                  onClick={() => void startLinkSession()}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium transition"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : linkSession ? (
              <div className="mt-4 space-y-4">
                {/* QR Code Card */}
                <div className="relative mx-auto w-48 h-48 rounded-2xl border-2 border-indigo-500/30 bg-slate-950 p-2 shadow-inner flex items-center justify-center group overflow-hidden">
                  <img
                    src={linkSession.qrDataUrl}
                    alt="Echo Cihaz Bağlantı QR Kodu"
                    className="w-full h-full rounded-xl object-contain"
                  />
                  {linkState?.status === 'claimed' && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center animate-fade-in">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mb-2" />
                      <span className="text-xs font-semibold text-amber-300">İzin Bekleniyor</span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        {linkState.claimerDisplayName || 'Diğer cihazınız'} onay ekranını açtı.
                      </span>
                    </div>
                  )}
                  {linkState?.status === 'approved' && (
                    <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center animate-fade-in">
                      <ShieldCheck className="w-8 h-8 text-emerald-400 mb-1" />
                      <span className="text-xs font-bold text-emerald-300">İzin Verildi!</span>
                      <span className="text-[11px] text-slate-300 mt-1">Hesap aktarılıyor...</span>
                    </div>
                  )}
                  {(linkState?.status === 'rejected' || linkState?.status === 'expired' || timeLeft <= 0) && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center animate-fade-in">
                      <AlertCircle className="w-7 h-7 text-rose-400 mb-1" />
                      <span className="text-xs font-bold text-rose-300">
                        {linkState?.status === 'rejected' ? 'İstek Reddedildi' : 'Süre Doldu'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void startLinkSession()}
                        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
                      >
                        Yeniden Başlat
                      </button>
                    </div>
                  )}
                </div>

                {/* 6 Digit Code Box */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    VEYA BU KODU GİRİN
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-950 border border-indigo-500/40 text-xl font-mono font-bold tracking-widest text-indigo-300 shadow-sm">
                      {linkSession.linkCode}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Kodu Kopyala"
                    >
                      {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Status Bar & Timer */}
                <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 px-3 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        linkState?.status === 'claimed'
                          ? 'bg-amber-400'
                          : linkState?.status === 'approved'
                          ? 'bg-emerald-400'
                          : 'bg-indigo-400'
                      }`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        linkState?.status === 'claimed'
                          ? 'bg-amber-500'
                          : linkState?.status === 'approved'
                          ? 'bg-emerald-500'
                          : 'bg-indigo-500'
                      }`} />
                    </span>
                    <span className="text-slate-300 font-medium">
                      {linkState?.status === 'claimed'
                        ? 'Diğer cihazda izin bekleniyor...'
                        : linkState?.status === 'approved'
                        ? 'Giriş başarılı!'
                        : 'Eşleme kodu dinleniyor...'}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400 text-[11px]">
                    {formatSeconds(timeLeft)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 text-center leading-normal">
                  Kişisel kimlik anahtarınız cihazlar arasında uçtan uca şifrelenir (E2EE AES-GCM 256). Sunucu özel anahtarınızı asla göremez.
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
