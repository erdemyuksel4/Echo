import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  Volume2,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  EyeOff,
  Bot,
  Layers,
} from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { wsService } from '../services/websocket';

interface DiscordSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscordSyncModal: React.FC<DiscordSyncModalProps> = ({ isOpen, onClose }) => {
  const { activeGroupMeta, channels, discordConfig, discordState } = useChatStore();

  const [guildId, setGuildId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [syncAllChannels, setSyncAllChannels] = useState(true);
  const [showBotToken, setShowBotToken] = useState(false);
  const [enabled, setEnabled] = useState(true);

  // Advanced / Single channel manual fallback
  const [echoChannelId, setEchoChannelId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (discordConfig) {
        setGuildId(discordConfig.guildId || '');
        setBotToken(discordConfig.hasBotToken ? '••••••••••••••••' : '');
        setWebhookUrl(discordConfig.hasWebhook ? '••••••••••••••••' : '');
        setSyncAllChannels(discordConfig.syncAllChannels !== false);
        setEchoChannelId(discordConfig.echoChannelId || '');
        setDiscordChannelId(discordConfig.discordChannelId || '');
        setEnabled(discordConfig.enabled);
      } else {
        const firstText = channels.find((c) => c.type === 'text');
        if (firstText) setEchoChannelId(firstText.id);
        setSyncAllChannels(true);
      }
      setFeedback(null);
    }
  }, [isOpen, discordConfig, channels]);

  if (!isOpen) return null;

  const textChannels = channels.filter((c) => c.type === 'text');

  const handleSave = () => {
    if (!guildId.trim()) {
      setFeedback({ type: 'error', message: 'Lütfen Discord Sunucu ID (Guild ID) girin.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const actualBotToken = botToken.startsWith('••••') ? undefined : botToken.trim() || undefined;
    const actualWebhookUrl = webhookUrl.startsWith('••••') ? undefined : webhookUrl.trim() || undefined;

    wsService.setDiscordConfig({
      guildId: guildId.trim(),
      echoChannelId: echoChannelId || (textChannels[0]?.id ?? ''),
      webhookUrl: actualWebhookUrl,
      botToken: actualBotToken,
      discordChannelId: discordChannelId.trim() || undefined,
      syncAllChannels,
      enabled,
    });

    setTimeout(() => {
      setIsSaving(false);
      setFeedback({
        type: 'success',
        message: 'Discord ayarları kaydedildi ve tüm kanallar senkronize ediliyor!',
      });
      wsService.syncDiscordNow();
    }, 600);
  };

  const handleTestSync = () => {
    wsService.syncDiscordNow();
    setFeedback({
      type: 'success',
      message: 'Discord sunucusuyla yeniden senkronize ediliyor...',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 shadow-sm">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Discord Sunucusuyla Eşle</span>
                <span className="rounded bg-[#5865F2] px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                  ENTEGRASYON
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {activeGroupMeta?.name || 'Grup'} için tüm Discord kanalları ve mesaj köprüsü
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {feedback && (
            <div
              className={`flex items-start gap-2.5 rounded-xl p-3 text-xs leading-relaxed ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Active status card */}
          {discordState && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-white">{discordState.guildName}</span>
                </div>
                <button
                  onClick={handleTestSync}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition"
                  title="Şimdi Senkronize Et"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Yenile</span>
                </button>
              </div>

              {discordState.error ? (
                <div className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-500/20 rounded p-2">
                  ⚠️ {discordState.error}
                </div>
              ) : (
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-indigo-400" />
                    <b className="text-white">{discordState.onlineMembers.length}</b> aktif üye
                  </span>
                  <span className="flex items-center gap-1">
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    <b className="text-white">{discordState.voiceChannels.length}</b> ses odası
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            {/* 1. Discord Server ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>1. Discord Sunucu ID (Guild ID) *</span>
                <span className="text-[10px] text-slate-500 font-normal">Zorunlu</span>
              </label>
              <input
                type="text"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="Örn: 1049284729102837482"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400 leading-tight">
                💡 Discord'da sunucu simgesine/adına sağ tıklayıp <b>Sunucu Kimliğini Kopyala</b> deyin. (Geliştirici Modu açık olmalıdır).
              </p>
            </div>

            {/* 2. Discord Bot Token */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-indigo-400" />
                  <span>2. Discord Bot Token (Önerilen)</span>
                </span>
                <span className="text-[10px] text-indigo-400 font-normal">Tüm Kanallar İçin</span>
              </label>
              <div className="relative">
                <input
                  type={showBotToken ? 'text' : 'password'}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Discord Developer Portal Bot Token..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-9 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showBotToken ? 'Gizle' : 'Göster'}
                >
                  {showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-tight">
                Discord Developer Portal'dan aldığınız Bot Token. Discord sunucunuz özel/gizli kalsa bile tüm kanalları otomatik bağlar.
              </p>
              <div className="mt-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 p-2.5 text-[11px] leading-relaxed text-slate-300">
                <p className="font-semibold text-indigo-300 flex items-center gap-1.5 mb-1">
                  <span>💡 Mesajların adınızla görünmesi için (Webhook İzni):</span>
                </p>
                <p className="text-slate-400">
                  Discord sunucunuzda <b>Sunucu Ayarları → Roller → Bot Rolünüz → İzinler</b> sekmesine gidip <b>&quot;Webhook&apos;ları Yönet&quot; (Manage Webhooks)</b> iznini açık yapın.
                  Böylece Echo&apos;dan yazdığınız mesajlar Discord&apos;da bot adı yerine otomatik olarak doğrudan kendi kullanıcı adınızla görünür.
                </p>
              </div>
            </div>

            {/* 3. Auto-sync All Channels Checkbox */}
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncAllChannels}
                  onChange={(e) => setSyncAllChannels(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Tüm Discord Kanallarını Otomatik Echo'ya Aktar ve Eşle</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                    Discord sunucunuzdaki tüm yazı ve ses odaları Echo'da otomatik oluşturulur. Echo'daki kanallardan yazdığınız mesajlar Discord'daki aynı kanala, Discord'daki mesajlar da Echo'daki kanala anında iletilir.
                  </p>
                </div>
              </label>
            </div>

            {/* Advanced: Manual single-channel Webhook fallback */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 transition"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>İsteğe Bağlı: Manuel Tek Kanal Webhook Ayarları</span>
              </button>

              {showAdvanced && (
                <div className="mt-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/50 space-y-3 text-xs">
                  <div className="flex items-start gap-2 text-[11px] text-slate-400">
                    <HelpCircle className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      Bot Token kullanmak istemiyorsanız yalnızca tek bir kanal için Webhook URL girerek Echo'dan Discord'a tek yönlü mesaj iletebilirsiniz.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Eşlenecek Echo Yazı Kanalı
                    </label>
                    <select
                      value={echoChannelId}
                      onChange={(e) => setEchoChannelId(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {textChannels.map((c) => (
                        <option key={c.id} value={c.id}>
                          #{c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Discord Webhook URL
                    </label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Tekil Discord Kanal ID
                    </label>
                    <input
                      type="text"
                      value={discordChannelId}
                      onChange={(e) => setDiscordChannelId(e.target.value)}
                      placeholder="Örn: 987654321098765432"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Toggle Enable */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-300 font-medium">Senkronizasyonu Aktif Et</span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  enabled ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800/80 px-6 py-3.5 bg-slate-950/40">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            Vazgeç
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Tüm Kanalları Eşle & Başlat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
