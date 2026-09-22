import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  Sliders,
  Laptop,
  Video,
  Info,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { soundService } from '../services/sound';
import { webrtcService } from '../services/webrtc';
import { useVoiceStore } from '../stores/useVoiceStore';

type AppInfo = Awaited<ReturnType<NonNullable<typeof window.echoApi>['getAppInfo']>>;

type SettingsTab = 'voice' | 'notifications' | 'about';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, initialTab = 'voice' }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

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

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>(
    webrtcService.getVideoDeviceId() || '',
  );
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const testVideoRef = useRef<HTMLVideoElement | null>(null);

  const { inputMode, pttKeyDisplay, pttReleaseDelay, setInputMode, setPttReleaseDelay } =
    useVoiceStore();

  const [isRecordingPttKey, setIsRecordingPttKey] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (window.echoApi?.getAppInfo) {
        void window.echoApi.getAppInfo().then((info) => {
          setAppInfo(info);
        });
      }
      if (window.echoApi?.getLoginItemSettings) {
        void window.echoApi.getLoginItemSettings().then((settings) => {
          setAutoStartEnabled(Boolean(settings?.openAtLogin));
        });
      }
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !window.echoApi?.onUpdateStatus) return;
    const cleanup = window.echoApi.onUpdateStatus((data) => {
      setIsCheckingUpdate(false);
      if (data.status === 'checking') {
        setUpdateStatus('Güncellemeler denetleniyor...');
      } else if (data.status === 'not-available') {
        setUpdateStatus('En güncel sürümü kullanıyorsunuz.');
      } else if (data.status === 'available') {
        setUpdateStatus(`Yeni sürüm bulundu (v${data.version || ''}), otomatik indiriliyor...`);
      } else if (data.status === 'downloaded') {
        setUpdateStatus(`Güncelleme indirildi (v${data.version || ''}), yeniden başlatılıyor...`);
      } else if (data.status === 'error') {
        setUpdateStatus(`Güncelleme kontrolü: ${data.error || 'Bağlantı hatası'}`);
      }
    });
    return cleanup;
  }, [isOpen]);

  useEffect(() => {
    if (!isRecordingPttKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      let display = e.key.toUpperCase();
      if (e.code.startsWith('Key')) {
        display = e.code.replace('Key', '');
      } else if (e.code === 'Space') {
        display = 'Boşluk (Space)';
      } else if (e.code === 'ControlRight') {
        display = 'Sağ Ctrl';
      } else if (e.code === 'ControlLeft') {
        display = 'Sol Ctrl';
      } else if (e.code === 'AltRight') {
        display = 'Sağ Alt';
      } else if (e.code === 'AltLeft') {
        display = 'Sol Alt';
      } else if (e.code === 'ShiftRight') {
        display = 'Sağ Shift';
      } else if (e.code === 'ShiftLeft') {
        display = 'Sol Shift';
      } else if (e.code === 'CapsLock') {
        display = 'Caps Lock';
      }

      useVoiceStore.getState().setPttKey(e.code, display);
      setIsRecordingPttKey(false);
    };

    window.addEventListener('keydown', handleKeyDown, { once: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecordingPttKey]);

  useEffect(() => {
    if (isOpen) {
      void webrtcService.getAudioDevices().then(({ inputs, outputs }) => {
        setInputDevices(inputs);
        setOutputDevices(outputs);
        setSelectedInputId((prev) => prev || (inputs.length > 0 ? inputs[0]!.deviceId : ''));
      });
      void webrtcService.getVideoDevices().then((videos) => {
        setVideoDevices(videos);
        setSelectedVideoId((prev) => prev || (videos.length > 0 ? videos[0]!.deviceId : ''));
      });
    } else {
      setIsTestingMic(false);
      setMicLevel(0);
      setIsTestingCamera(false);
      setIsRecordingPttKey(false);
    }
  }, [isOpen]);

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

  useEffect(() => {
    if (isTestingCamera && testVideoRef.current) {
      const cleanup = webrtcService.testCamera(testVideoRef.current);
      return () => {
        cleanup();
      };
    }
    return undefined;
  }, [isTestingCamera]);

  const handleVideoDeviceChange = async (deviceId: string) => {
    setSelectedVideoId(deviceId);
    await webrtcService.setVideoDevice(deviceId);
    if (isTestingCamera && testVideoRef.current) {
      setIsTestingCamera(false);
      setTimeout(() => setIsTestingCamera(true), 50);
    }
  };

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

  const handleToggleAutoStart = async () => {
    const next = !autoStartEnabled;
    setAutoStartEnabled(next);
    if (window.echoApi?.setLoginItemSettings) {
      await window.echoApi.setLoginItemSettings(next);
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

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus('Güncellemeler denetleniyor...');
    try {
      if (window.echoApi?.checkForUpdates) {
        await window.echoApi.checkForUpdates();
        setTimeout(() => {
          setIsCheckingUpdate(false);
          setUpdateStatus((prev) =>
            prev === 'Güncellemeler denetleniyor...'
              ? 'Echo güncel. En son sürümü kullanıyorsunuz.'
              : prev,
          );
        }, 2500);
      } else {
        setIsCheckingUpdate(false);
        setUpdateStatus('Geliştirici modunda güncelleme denetlenemez.');
      }
    } catch {
      setIsCheckingUpdate(false);
      setUpdateStatus('Güncelleme denetlenirken bir hata oluştu.');
    }
  };

  const handleOpenGithub = () => {
    if (window.echoApi?.openExternal) {
      void window.echoApi.openExternal('https://github.com/erdemyuksel4/Echo');
    } else {
      window.open('https://github.com/erdemyuksel4/Echo', '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header with Navigation Tabs */}
        <div className="border-b border-slate-800 bg-slate-950/80 px-6 pt-4 pb-0">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2.5 text-white">
              <Settings className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-bold">Ayarlar &amp; Yapılandırma</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 -mb-px">
            <button
              type="button"
              onClick={() => setActiveTab('voice')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition ${
                activeTab === 'voice'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Ses &amp; Görüntü</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition ${
                activeTab === 'notifications'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Bildirim &amp; Tercihler</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition ${
                activeTab === 'about'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Info className="h-3.5 w-3.5" />
              <span>Hakkında</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tab 1: Voice & Audio Settings */}
          {activeTab === 'voice' && (
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
                      <h3 className="text-sm font-semibold text-white">
                        Çıkış (Hoparlör &amp; Kulaklık)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Gelen seslerin çalınacağı çıkış düzeyi
                      </p>
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
                      <span className="font-mono text-slate-200 font-semibold">
                        {outputVolume}%
                      </span>
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

                {/* Voice Transmission Mode (VAD vs PTT) */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
                      <Sliders className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">Ses İletim Modu</h3>
                      <p className="text-xs text-slate-400">
                        Sesinizin kanala nasıl aktarılacağını seçin
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setInputMode('vad');
                        webrtcService.setInputMode('vad');
                      }}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition ${
                        inputMode === 'vad'
                          ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm shadow-indigo-500/10'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-xs font-bold">Ses Etkinliği (VAD)</span>
                      <span className="text-[11px] text-slate-400">
                        Konuştuğunuzda otomatik algılanır
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInputMode('ptt');
                        webrtcService.setInputMode('ptt');
                      }}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition ${
                        inputMode === 'ptt'
                          ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm shadow-indigo-500/10'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-xs font-bold">Bas-Konuş (Push-to-Talk)</span>
                      <span className="text-[11px] text-slate-400">
                        Belirlenen tuşa basarak konuşun
                      </span>
                    </button>
                  </div>

                  {inputMode === 'ptt' && (
                    <div className="pt-3 space-y-3 border-t border-slate-800/80 animate-in fade-in duration-150">
                      {/* Keybinding recorder */}
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold text-white">Bas-Konuş Tuşu</div>
                          <div className="text-[11px] text-slate-400">
                            Konuşmak için basılı tutacağınız tuş
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsRecordingPttKey(true)}
                          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-mono font-bold transition border ${
                            isRecordingPttKey
                              ? 'border-amber-500 bg-amber-500/20 text-amber-300 animate-pulse'
                              : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-indigo-500 hover:bg-slate-750'
                          }`}
                        >
                          <Keyboard className="h-3.5 w-3.5 text-indigo-400" />
                          <span>{isRecordingPttKey ? 'Bir tuşa basın...' : pttKeyDisplay}</span>
                        </button>
                      </div>

                      {/* Release delay */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Bırakma Gecikmesi</span>
                          <span className="font-mono text-slate-200 font-semibold">
                            {pttReleaseDelay} ms
                          </span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="1000"
                          step="50"
                          value={pttReleaseDelay}
                          onChange={(e) => setPttReleaseDelay(Number(e.target.value))}
                          className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-500">
                          Tuşu bıraktıktan sonra sesinizin ani kesilmemesi için beklenen süre.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera & Video Settings */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
                      <Video className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">Kamera &amp; Video</h3>
                      <p className="text-xs text-slate-400">
                        Kamera aygıtını seçin ve canlı ayna görüntünüzü test edin
                      </p>
                    </div>
                  </div>

                  {/* Webcam Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Kamera Aygıtı</label>
                    {videoDevices.length === 0 ? (
                      <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-500 italic">
                        Algılanan kamera bulunamadı
                      </div>
                    ) : (
                      <select
                        value={selectedVideoId}
                        onChange={(e) => void handleVideoDeviceChange(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      >
                        {videoDevices.map((dev, idx) => (
                          <option key={dev.deviceId || idx} value={dev.deviceId}>
                            {dev.label || `Kamera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Camera Test Section */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">
                        Kamera Önizleme &amp; Ayna Testi
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsTestingCamera((prev) => !prev)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                          isTestingCamera
                            ? 'bg-rose-600 text-white hover:bg-rose-500'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        {isTestingCamera ? (
                          <>
                            <Square className="h-3 w-3 fill-current" />
                            <span>Testi Durdur</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 fill-current" />
                            <span>Kamerayı Test Et</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isTestingCamera ? (
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/50 shadow-inner flex items-center justify-center">
                        <video
                          ref={testVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover -scale-x-100"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded-md border border-emerald-500/30 text-[11px] font-medium text-emerald-400">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Canlı Önizleme (480p24)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
                        Görüntünüzü kontrol etmek için yukarıdaki &quot;Kamerayı Test Et&quot;
                        düğmesine tıklayın.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Notification & Preferences */}
          {activeTab === 'notifications' && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Bildirim &amp; Tercihler
              </div>

              <div className="space-y-3">
                {/* Windows Auto-Start Toggle */}
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600/20 text-sky-400">
                      <Laptop className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Windows ile Birlikte Başlat
                      </h3>
                      <p className="text-xs text-slate-400">
                        Bilgisayar açıldığında Echo otomatik başlasın
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleAutoStart}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoStartEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoStartEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

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
                    <span className="font-semibold text-slate-300">
                      Gizlilik &amp; Sistem Tepsisi:{' '}
                    </span>
                    Pencereyi kapattığınızda Echo arka planda sistem tepsisinde çalışmaya devam eder
                    ve sesli bağlantınızı koparmadan arka planda tutar.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: About Echo */}
          {activeTab === 'about' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Hero Banner */}
              <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-950 p-5 shadow-lg">
                <div className="relative z-10 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xl shadow-indigo-600/30 ring-2 ring-indigo-400/20">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black tracking-tight text-white">Echo</h3>
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-mono font-bold text-indigo-300 border border-indigo-500/30">
                        v{appInfo?.appVersion || '0.1.0'}
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Canlı
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      Güvenli, hafif, modern ve P2P mesh mimarili yeni nesil sesli/yazılı iletişim
                      platformu.
                    </p>
                  </div>
                </div>
              </div>

              {/* Version & Environment Details */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Sürüm &amp; Çalışma Ortamı
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                    <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5">
                      <Layers className="h-3 w-3 text-indigo-400" />
                      <span>Protokol Sürümü</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-white">
                      Echo Protocol v{appInfo?.protocolVersion || 1}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                    <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 text-emerald-400" />
                      <span>İşletim Sistemi &amp; Mimari</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-white capitalize">
                      {appInfo?.platform || 'Windows'} ({appInfo?.arch || 'x64'})
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                    <div className="text-[10px] font-medium text-slate-400">Electron Çekirdeği</div>
                    <div className="font-mono text-xs font-bold text-slate-200">
                      v{appInfo?.electronVersion || '34.x'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                    <div className="text-[10px] font-medium text-slate-400">
                      Chromium &amp; Node.js
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-200 truncate">
                      Chrome {appInfo?.chromeVersion?.split('.')[0] || '132'} / Node{' '}
                      {appInfo?.nodeVersion || '20.x'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Architectural Principles */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Mimari &amp; Güvenlik
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-200">Ed25519 Kimlik</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Şifre yok, cihazda şifrelenen özel anahtar.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <Radio className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-200">P2P WebRTC Mesh</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Eşler arası doğrudan şifreli ses &amp; görüntü.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <CheckCircle2 className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-200">Sıfır Telemetri</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Hiçbir kullanıcı takibi ve reklam içermez.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <Layers className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-200">Cloudflare DO</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Sunucusuz SQLite &amp; WebSocket Hibernation.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Updates Section */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Yazılım Güncellemeleri</h4>
                    <p className="text-xs text-slate-400">Otomatik arka plan güncellemeleri</p>
                  </div>
                  <button
                    type="button"
                    disabled={isCheckingUpdate}
                    onClick={handleCheckUpdates}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`}
                    />
                    <span>{isCheckingUpdate ? 'Denetleniyor...' : 'Güncellemeleri Denetle'}</span>
                  </button>
                </div>

                {updateStatus && (
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-xs text-slate-300 flex items-center gap-2">
                    <Info className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                    <span>{updateStatus}</span>
                  </div>
                )}
              </div>

              {/* Open Source & Links Footer */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs">
                <div className="text-slate-400">
                  Echo açık kaynaklı bir yazılımdır (MIT Lisansı).
                </div>
                <button
                  type="button"
                  onClick={handleOpenGithub}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition font-medium"
                >
                  <span>GitHub</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
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
