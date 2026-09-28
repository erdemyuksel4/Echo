import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';
export const ImageViewerModal = ({ imageUrl, imageName = 'Görsel', onClose, }) => {
    const [scale, setScale] = useState(1);
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    const handleZoomIn = (e) => {
        e.stopPropagation();
        setScale((prev) => Math.min(prev + 0.25, 3));
    };
    const handleZoomOut = (e) => {
        e.stopPropagation();
        setScale((prev) => Math.max(prev - 0.25, 0.5));
    };
    const handleResetZoom = (e) => {
        e.stopPropagation();
        setScale(1);
    };
    const handleDownload = (e) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = imageName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150", onClick: onClose, children: [_jsxs("div", { className: "absolute top-4 right-6 flex items-center gap-2 bg-[#18191c]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-white z-10", onClick: (e) => e.stopPropagation(), children: [_jsx("span", { className: "text-xs text-neutral-300 mr-2 max-w-[200px] truncate", children: imageName }), _jsx("button", { onClick: handleZoomOut, className: "p-1.5 hover:bg-white/10 rounded transition text-neutral-300 hover:text-white", title: "Uzakla\u015Ft\u0131r", children: _jsx(ZoomOut, { className: "w-4 h-4" }) }), _jsx("button", { onClick: handleResetZoom, className: "p-1.5 hover:bg-white/10 rounded transition text-neutral-300 hover:text-white text-xs font-mono", title: "S\u0131f\u0131rla", children: _jsx(RotateCcw, { className: "w-4 h-4" }) }), _jsx("button", { onClick: handleZoomIn, className: "p-1.5 hover:bg-white/10 rounded transition text-neutral-300 hover:text-white", title: "Yak\u0131nla\u015Ft\u0131r", children: _jsx(ZoomIn, { className: "w-4 h-4" }) }), _jsx("div", { className: "w-[1px] h-4 bg-white/20 mx-1" }), _jsx("button", { onClick: handleDownload, className: "p-1.5 hover:bg-white/10 rounded transition text-neutral-300 hover:text-white", title: "\u0130ndir", children: _jsx(Download, { className: "w-4 h-4" }) }), _jsx("button", { onClick: onClose, className: "p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition text-neutral-300", title: "Kapat (Esc)", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsx("div", { className: "max-w-[90vw] max-h-[85vh] flex items-center justify-center overflow-hidden cursor-default", onClick: (e) => e.stopPropagation(), children: _jsx("img", { src: imageUrl, alt: imageName, style: { transform: `scale(${scale})` }, className: "max-w-full max-h-[85vh] object-contain rounded transition-transform duration-100 ease-out select-none shadow-2xl" }) })] }));
};
