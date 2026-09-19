import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

interface ImageViewerModalProps {
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  imageUrl,
  imageName = 'Görsel',
  onClose,
}) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleZoomIn = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setScale(1);
  };

  const handleDownload = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = imageName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top Bar Controls */}
      <div
        className="absolute top-4 right-6 flex items-center gap-2 bg-[#18191c]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-neutral-300 mr-2 max-w-[200px] truncate">{imageName}</span>
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-white/10 rounded transition text-neutral-300 hover:text-white"
          title="Uzaklaştır"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1.5 hover:bg-white/10 rounded transition text-neutral-300 hover:text-white text-xs font-mono"
          title="Sıfırla"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-white/10 rounded transition text-neutral-300 hover:text-white"
          title="Yakınlaştır"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-white/20 mx-1" />
        <button
          onClick={handleDownload}
          className="p-1.5 hover:bg-white/10 rounded transition text-neutral-300 hover:text-white"
          title="İndir"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition text-neutral-300"
          title="Kapat (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Image Container */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center overflow-hidden cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={imageName}
          style={{ transform: `scale(${scale})` }}
          className="max-w-full max-h-[85vh] object-contain rounded transition-transform duration-100 ease-out select-none shadow-2xl"
        />
      </div>
    </div>
  );
};
