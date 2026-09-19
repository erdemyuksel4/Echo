import React, { useState } from 'react';
import { Settings, Volume2, Bell, Shield, X } from 'lucide-react';
import { soundService } from '../services/sound';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [soundEnabled, setSoundEnabled] = useState(soundService.isEnabled());
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('echo_notifications_enabled');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setEnabled(next);
    if (next) soundService.playNotification();
  };

  const handleToggleNotif = () => {
    const next = !notifEnabled;
    setNotifEnabled(next);
    try {
      localStorage.setItem('echo_notifications_enabled', String(next));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-white">
            <Settings className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold">Ayarlar</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {/* Sound Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
                <Volume2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Bildirim Sesleri</h3>
                <p className="text-xs text-slate-400">Gelen mesajlar için sesli uyarı çal</p>
              </div>
            </div>
            <button
              onClick={handleToggleSound}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                soundEnabled ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Desktop Notification Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Masaüstü Bildirimleri</h3>
                <p className="text-xs text-slate-400">Windows sistem bildirimleri gönder</p>
              </div>
            </div>
            <button
              onClick={handleToggleNotif}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifEnabled ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Privacy Note */}
          <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-400">
            <Shield className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Gizlilik &amp; Sistem Tepsisi: </span>
              Pencereyi kapattığınızda Echo arka planda sistem tepsisinde (saat yanında) çalışmaya devam eder ve yeni mesaj bildirimlerini kaçırmazsınız.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
