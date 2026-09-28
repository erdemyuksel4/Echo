import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
const COLOR_PALETTE = [
    '#4f46e5', // Indigo
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Rose
    '#8b5cf6', // Purple
    '#ec4899', // Pink
];
export const OnboardingModal = () => {
    const { createIdentity } = useAuthStore();
    const [displayName, setDisplayName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0] ?? '#4f46e5');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = displayName.trim();
        if (trimmed.length < 2 || trimmed.length > 32) {
            setError('Görünen ad 2 ile 32 karakter arasında olmalıdır.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await createIdentity(trimmed, selectedColor);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Profil oluşturulamadı');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg transition-colors", style: { backgroundColor: selectedColor }, children: displayName.trim() ? displayName.trim().charAt(0).toUpperCase() : 'E' }), _jsx("h2", { className: "mt-4 text-xl font-bold text-white", children: "Echo'ya Ho\u015F Geldiniz" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Kullan\u0131c\u0131 ad\u0131 ve avatar renginizi se\u00E7erek hemen ba\u015Flay\u0131n." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "mt-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1", children: "G\u00F6r\u00FCnen Ad" }), _jsx("input", { type: "text", value: displayName, onChange: (e) => setDisplayName(e.target.value), placeholder: "\u00D6rn: Erdem", maxLength: 32, className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none", autoFocus: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2", children: "Avatar Rengi" }), _jsx("div", { className: "flex gap-2 justify-center", children: COLOR_PALETTE.map((color) => (_jsx("button", { type: "button", onClick: () => setSelectedColor(color), className: `h-8 w-8 rounded-full transition-transform ${selectedColor === color
                                            ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                                            : 'hover:scale-110'}`, style: { backgroundColor: color } }, color))) })] }), _jsxs("div", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200", children: [_jsx("span", { className: "font-semibold text-amber-300", children: "Gizlilik Notu: " }), "Ses ve ekran ak\u0131\u015Flar\u0131 WebRTC (DTLS-SRTP) ile u\u00E7tan uca \u015Fifreli iletilir. Yaz\u0131l\u0131 mesajlar ve grup verileri Cloudflare sunucusunda d\u00FCz metin olarak saklan\u0131r."] }), error && _jsx("div", { className: "text-xs text-rose-400 text-center", children: error }), _jsx("button", { type: "submit", disabled: loading || !displayName.trim(), className: "w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50", children: loading ? 'Oluşturuluyor...' : 'Hesap Oluştur ve Başla' })] })] }) }));
};
