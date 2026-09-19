import React, { useState, useEffect } from 'react';
import {
  Settings,
  Volume2,
  Bell,
  Shield,
  X,
  Mic,
  Headphones,
  Play,
  Square,
} from 'lucide-react';
import { soundService } from '../services/sound';
import { webrtcService } from '../services/webrtc';

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

  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>(
    webrtcService.getInputDeviceId() || '',
  );
  const [outputVolume, setOutputVolume] = useState<number>(
    Math.round(webrtcService.getOutputVolume() * 100),
  );

  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    if (isOpen) {
      void webrtcService.getAudioDevices().then(({ inputs, outputs }) => {
        setInputDevices(inputs);
        setOutputDevices(outputs);
        if (!selectedInputId && inputs.length > 0) {
          setSelectedInputId(inputs[0]!.deviceId);
        }
      });
    } else {
      setIsTestingMic(false);
      setMicLevel(0);
    }
  }, [isOpen, selectedInputId]);

  useEffect(() => {
    if (isTestingMic) {
      const cleanup = webrtcService.testMicrophone((level) => {
        setMicLevel(level);
      });
      return () => {
        cleanup();
      };
    } else {
      setMicLevel(0);
      return undefined;
    }
  }, [isTestingMic]);

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

  const handleInputChange = (deviceId: string) => {
    setSelectedInputId(deviceId);
    void webrtcService.setInputDevice(deviceId);
  };

  const handleVolumeChange = (volPercent: number) => {
    setOutputVolume(volPercent);
    webrtcService.setOutputVolume(volPercent / 100);
  };

  const handleTestSound = () => {
    soundService.playNotification();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-2.5 text-white">
            <Settings className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold">Ayarlar &amp; Ses Yapılandırması</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Voice & Audio Settings */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Ses &amp; Donanım Ayarları
            </div>

            <div className="space-y-4">
              {/* Microphone Selection & Test */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">Giriş Cihazı (Mikrofon)</h3>
                    <p className="text-xs text-slate-400">Sesli sohbette kullanılacak mikrofon</p>
                  </div>
                </div>

                <select
                  value={selectedInputId}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                >
                  {inputDevices.length === 0 ? (
                    <option value="">Varsayılan Sistem Mikrofonu</option>
                  ) : (
                    inputDevices.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `Mikrofon ${idx + 1}`}
                      </option>
                    ))
                  )}
                </select>

                {/* Mic Test Button & Level Meter */}
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">Mikrofon Seviyesi</span>
                    <button
                      type="button"
                      onClick={() => setIsTestingMic(!isTestingMic)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                        isTestingMic
                          ? 'bg-rose-600 text-white hover:bg-rose-500'
                          : 'bg-indigo-600 text-white hover:bg-indigo-500'
                      }`}
                    >
                      {isTestingMic ? (
                        <>
                          <Square className="h-3 w-3" />
                          <span>Testi Durdur</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          <span>Mikrofonu Test Et</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Visual Live Volume Meter Bar */}
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-75 ${
                        micLevel > 0.6
                          ? 'bg-rose-500'
                          : micLevel > 0.2
                          ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                          : 'bg-slate-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.round(micLevel * 100))}%` }}
                    />
                  </div>
                  {isTestingMic && (
                    <p className="text-[11px] text-emerald-400">
                      Mikrofona konuşun: Yeşil bar sesinizi algıladıkça sağa doğru yükselecektir.
                    </p>
                  )}
                </div>
              </div>

              {/* Output (Headphones / Speakers) & Volume */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20 text-purple-400">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">Çıkış (Hoparlör &amp; Kulaklık)</h3>
                    <p className="text-xs text-slate-400">Gelen seslerin çalınacağı çıkış düzeyi</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
                    title="Hoparlörü test et"
                  >
                    <Play className="h-3 w-3 text-purple-400" />
                    <span>Sesi Test Et</span>
                  </button>
                </div>

                {outputDevices.length > 0 && (
                  <select
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    disabled
                  >
                    {outputDevices.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `Hoparlör ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}

                {/* Volume Slider */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Ses Düzeyi</span>
                    <span className="font-mono text-slate-200 font-semibold">{outputVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={outputVolume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Notification & Preferences */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Bildirim &amp; Tercihler
            </div>

            <div className="space-y-3">
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
                  Pencereyi kapattığınızda Echo arka planda sistem tepsisinde çalışmaya devam eder ve sesli bağlantınızı koparmadan arka planda tutar.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 bg-slate-950/60 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
