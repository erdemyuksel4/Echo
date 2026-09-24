import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX, X, Radio, Loader2 } from 'lucide-react';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { useScreenShareViewerDucking } from '../hooks/useScreenShareViewerDucking';

export const ScreenShareViewer: React.FC = () => {
  const {
    viewingShare,
    isModalViewerOpen,
    closeModalViewer,
    viewerVolume,
    isViewerMuted,
    setViewerVolume,
    setIsViewerMuted,
  } = useScreenShareStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isDucked } = useScreenShareViewerDucking({
    videoRef,
    userVolume: viewerVolume,
    isMuted: isViewerMuted,
    isLocal: false,
  });

  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && viewingShare?.stream) {
      if (el.srcObject !== viewingShare.stream) {
        el.srcObject = viewingShare.stream;
      }
      el.muted = isViewerMuted;
      el.volume = isViewerMuted ? 0 : viewerVolume;
      void el.play().catch((err) => console.warn('Autoplay error:', err));
    }
  };

  useEffect(() => {
    if (videoRef.current && viewingShare?.stream) {
      if (videoRef.current.srcObject !== viewingShare.stream) {
        videoRef.current.srcObject = viewingShare.stream;
      }
      videoRef.current.muted = isViewerMuted;
      videoRef.current.volume = isViewerMuted ? 0 : viewerVolume;
      void videoRef.current.play().catch((err) => console.warn('Autoplay error:', err));
    }
  }, [viewingShare?.stream, isViewerMuted, viewerVolume]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isFullscreen) {
        setShowControls(false);
      }
    }, 2500);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  if (!viewingShare || !isModalViewerOpen) return null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md select-none ${
        isFullscreen ? 'p-0' : 'p-4 sm:p-8'
      }`}
    >
      <div
        className={`relative flex flex-1 flex-col overflow-hidden bg-black ${
          isFullscreen ? 'rounded-none' : 'rounded-2xl border border-slate-800 shadow-2xl'
        }`}
      >
        {/* Stream Video Element */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          {viewingShare.isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">
                {viewingShare.displayName} kullanıcısının yayınına bağlanılıyor...
              </span>
            </div>
          ) : (
            <video ref={attachVideo} autoPlay playsInline className="h-full w-full object-contain" />
          )}
        </div>

        {/* Floating Top Bar (Controls) */}
        <div
          className={`absolute top-0 inset-x-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-200 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
              <Radio className="h-3 w-3 animate-pulse" />
              <span>CANLI</span>
            </div>
            <span className="text-sm font-bold text-white drop-shadow">
              {viewingShare.displayName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Volume Slider */}
            <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 backdrop-blur px-3 py-1.5 border border-slate-700/60 shadow">
              <button
                type="button"
                onClick={() => setIsViewerMuted(!isViewerMuted)}
                className="text-slate-300 hover:text-white transition"
                title={isViewerMuted ? 'Yayın Sesini Aç' : 'Yayın Sesini Sustur'}
              >
                {isViewerMuted || viewerVolume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-slate-200" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isViewerMuted ? 0 : viewerVolume}
                onChange={(e) => {
                  setViewerVolume(parseFloat(e.target.value));
                  if (isViewerMuted) setIsViewerMuted(false);
                }}
                className="w-20 accent-indigo-500 cursor-pointer"
                title={`Yayın Sesi: %${Math.round((isViewerMuted ? 0 : viewerVolume) * 100)}`}
              />
              {isDucked && (
                <span
                  className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded animate-pulse"
                  title="Konuştuğunuz için sesiniz yayından yankılanmasın diye yayın sesi otomatik olarak kısıldı"
                >
                  Yankı Koruması
                </span>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="rounded-xl bg-slate-900/80 backdrop-blur p-2 text-slate-300 hover:text-white border border-slate-700/60 shadow transition"
              title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Close / Leave Stream Button */}
            <button
              onClick={closeModalViewer}
              className="rounded-xl bg-slate-800/80 backdrop-blur p-2 text-slate-300 hover:text-white border border-slate-700/60 shadow transition"
              title="Pencereyi Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
