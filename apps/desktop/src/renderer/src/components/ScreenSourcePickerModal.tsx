import React, { useState, useEffect } from 'react';
import { Monitor, AppWindow, Volume2, AlertTriangle, X, Play, RefreshCw } from 'lucide-react';
import type { ScreenShareSource, ScreenQualityPreset, ScreenShareMode } from '@echo/shared';
import { screenCaptureService } from '../services/screenShare/screenCaptureService';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { useVoiceStore } from '../stores/useVoiceStore';

interface ScreenSourcePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScreenSourcePickerModal: React.FC<ScreenSourcePickerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentChannelId } = useVoiceStore();
  const { startSharing } = useScreenShareStore();

  const [activeTab, setActiveTab] = useState<'screen' | 'window'>('screen');
  const [sources, setSources] = useState<ScreenShareSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [quality, setQuality] = useState<ScreenQualityPreset>('720p30');
  const [mode, setMode] = useState<ScreenShareMode>('motion');
  const [hasAudio, setHasAudio] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadSources = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (window.echoApi?.getDesktopSources) {
        const list = await window.echoApi.getDesktopSources();
        setSources(list);
        if (list.length > 0 && !selectedSourceId) {
          setSelectedSourceId(list[0]!.id);
        }
      }
    } catch (err) {
      console.error('Failed to load screen sources:', err);
      setErrorMsg('Kaynaklar yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadSources();
    } else {
      setSelectedSourceId(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const screenSources = sources.filter((s) => s.isScreen);
  const windowSources = sources.filter((s) => !s.isScreen);
  const displayedSources = activeTab === 'screen' ? screenSources : windowSources;

  const handleStart = async () => {
    if (!selectedSourceId || !currentChannelId) return;

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
    } catch (err) {
      console.error('Failed to start screen capture:', err);
      setErrorMsg('Ekran yakalama başlatılamadı. İzinleri kontrol edin.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ekranını Paylaş</h2>
              <p className="text-xs text-slate-400">
                Ses kanalındaki arkadaşlarına ekranını veya bir uygulamayı göster
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-3">
          <button
            onClick={() => {
              setActiveTab('screen');
              if (screenSources.length > 0) setSelectedSourceId(screenSources[0]!.id);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'screen'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>Tüm Ekranlar ({screenSources.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('window');
              if (windowSources.length > 0) setSelectedSourceId(windowSources[0]!.id);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'window'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AppWindow className="h-4 w-4" />
            <span>Uygulama Pencereleri ({windowSources.length})</span>
          </button>

          <button
            onClick={() => void loadSources()}
            className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 py-2.5 transition"
            title="Kaynakları Yenile"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>

        {/* Source Grid */}
        <div className="flex-1 overflow-y-auto p-6 max-h-64">
          {displayedSources.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center text-center text-slate-500">
              <p className="text-xs">Paylaşılabilir kaynak bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {displayedSources.map((source) => {
                const isSelected = selectedSourceId === source.id;
                return (
                  <button
                    key={source.id}
                    onClick={() => setSelectedSourceId(source.id)}
                    className={`group relative flex flex-col items-center rounded-xl border p-2 text-left transition overflow-hidden ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-600/10 ring-2 ring-indigo-500/40'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800/60 flex items-center justify-center mb-2">
                      {source.thumbnailDataUrl ? (
                        <img
                          src={source.thumbnailDataUrl}
                          alt={source.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Monitor className="h-8 w-8 text-slate-700" />
                      )}
                    </div>
                    <div className="w-full flex items-center gap-1.5 px-1">
                      {source.appIconDataUrl && (
                        <img
                          src={source.appIconDataUrl}
                          alt=""
                          className="h-3.5 w-3.5 flex-shrink-0"
                        />
                      )}
                      <span className="truncate text-xs font-medium text-slate-200">
                        {source.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quality, Mode & Audio Settings */}
        <div className="border-t border-slate-800/80 bg-slate-950/40 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Quality Preset */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Yayın Kalitesi
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['720p30', '1080p30', '1080p60'] as ScreenQualityPreset[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className={`rounded-lg py-1.5 text-xs font-semibold transition border ${
                      quality === q
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {q === '720p30'
                      ? '720p 30fps'
                      : q === '1080p30'
                        ? '1080p 30fps'
                        : '1080p 60fps'}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Mode */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Optimize Et
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('motion')}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition border ${
                    mode === 'motion'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Akıcı (Oyun & Video)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('detail')}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition border ${
                    mode === 'detail'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Netlik (Metin & Kod)
                </button>
              </div>
            </div>
          </div>

          {/* Warnings & Audio Toggle */}
          <div className="flex flex-col gap-2 pt-1">
            {quality === '1080p60' && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
                <span>
                  1080p 60fps yüksek bilgisayar performansı ve yükleme (upload) hızı gerektirir.
                </span>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={hasAudio}
                onChange={(e) => setHasAudio(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <Volume2 className="h-4 w-4 text-indigo-400" />
              <span>Sistem sesini de paylaş (Oyun ve müzik sesi)</span>
            </label>

            {hasAudio && activeTab === 'screen' && (
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-200">Sistem Sesi & Yankı Bilgilendirmesi</p>
                  <p className="text-amber-300/90 leading-relaxed">
                    Tüm masaüstü paylaşıldığında sistem sesine sesli sohbet sesleri karışabilir; yalnızca oyun/uygulama sesini paylaşmak için <strong>Pencere</strong> sekmesinden oyunu seçmeniz önerilir.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('window');
                      if (windowSources.length > 0) setSelectedSourceId(windowSources[0]!.id);
                    }}
                    className="mt-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                  >
                    Pencere sekmesine geç →
                  </button>
                </div>
              </div>
            )}

            {hasAudio && activeTab === 'window' && (
              <div className="flex items-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-2.5 text-xs text-indigo-300">
                <Volume2 className="h-4 w-4 flex-shrink-0 text-indigo-400" />
                <span>
                  Echo akıllı yankı önleyici ve ses ducking sistemi, ses kanalındaki arkadaşlarınız konuştuğunda yayın sesini otomatik dengeleyerek yankıyı önler.
                </span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950/80">
          <div className="text-[11px] text-slate-500">
            {activeTab === 'window' && 'Oyun paylaşıyorsanız Tüm Ekran seçmeniz önerilir.'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              İptal
            </button>
            <button
              type="button"
              disabled={!selectedSourceId || isCapturing}
              onClick={() => void handleStart()}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isCapturing ? 'Başlatılıyor...' : 'Yayını Başlat'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
