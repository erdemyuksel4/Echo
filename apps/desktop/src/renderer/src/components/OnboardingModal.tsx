import React, { useState } from 'react';
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

export const OnboardingModal: React.FC = () => {
  const { createIdentity } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0] ?? '#4f46e5');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

          {error && <div className="text-xs text-rose-400 text-center">{error}</div>}

          <button
            type="submit"
            disabled={loading || !displayName.trim()}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Oluşturuluyor...' : 'Hesap Oluştur ve Başla'}
          </button>
        </form>
      </div>
    </div>
  );
};
