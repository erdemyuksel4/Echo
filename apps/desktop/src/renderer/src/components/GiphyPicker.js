import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { SERVER_HTTP_URL } from '../config';
export const GiphyPicker = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);
    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose();
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);
    // Fetch GIFs (trending if empty, search if query typed)
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const endpoint = query.trim()
                    ? `${SERVER_HTTP_URL}/api/giphy/search?q=${encodeURIComponent(query.trim())}&limit=24`
                    : `${SERVER_HTTP_URL}/api/giphy/search?limit=24`;
                const res = await fetch(endpoint);
                if (res.ok && !cancelled) {
                    const data = (await res.json());
                    setResults(data.results || []);
                }
            }
            catch (err) {
                console.warn('Failed to load GIFs:', err);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }, query ? 350 : 0);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query]);
    return (_jsxs("div", { ref: containerRef, className: "absolute bottom-16 right-4 z-40 w-80 md:w-96 h-96 bg-[#2b2d31] border border-[#1f2023] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150", children: [_jsxs("div", { className: "p-3 border-b border-[#1f2023] flex items-center gap-2 bg-[#232428]", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" }), _jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Tenor / GIPHY'de GIF ara...", autoFocus: true, className: "w-full bg-[#1e1f22] text-sm text-neutral-100 pl-8 pr-7 py-1.5 rounded-md outline-none border border-transparent focus:border-indigo-500 placeholder-neutral-500 transition" }), query && (_jsx("button", { onClick: () => setQuery(''), className: "absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white", children: _jsx(X, { className: "w-3.5 h-3.5" }) }))] }), _jsx("button", { onClick: onClose, className: "p-1 text-neutral-400 hover:text-white rounded hover:bg-[#35373c] transition", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-700", children: loading ? (_jsxs("div", { className: "h-full flex items-center justify-center text-neutral-400 gap-2", children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin text-indigo-400" }), _jsx("span", { className: "text-xs", children: "GIF'ler y\u00FCkleniyor..." })] })) : results.length === 0 ? (_jsx("div", { className: "h-full flex items-center justify-center text-neutral-400 text-xs", children: "Sonu\u00E7 bulunamad\u0131." })) : (_jsx("div", { className: "grid grid-cols-2 gap-2", children: results.map((gif) => (_jsx("button", { onClick: () => onSelect(gif), className: "group relative h-28 rounded-lg overflow-hidden bg-[#1e1f22] hover:opacity-90 transition border border-transparent hover:border-indigo-500", children: _jsx("img", { src: gif.previewUrl || gif.url, alt: gif.title, loading: "lazy", className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" }) }, gif.id))) })) }), _jsxs("div", { className: "px-3 py-1.5 bg-[#1e1f22] border-t border-[#1f2023] flex items-center justify-between text-[10px] text-neutral-500", children: [_jsx("span", { children: "GIPHY / Tenor Entegrasyonu" }), _jsx("span", { className: "font-semibold text-neutral-400", children: "ECHO MEDIA" })] })] }));
};
