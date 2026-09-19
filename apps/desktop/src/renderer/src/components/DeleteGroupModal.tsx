import React, { useState } from 'react';
import { AlertTriangle, Trash2, LogOut, Loader2, X } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { wsService } from '../services/websocket';
import { webrtcService } from '../services/webrtc';
import { SERVER_HTTP_URL } from '../config';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  isOwner: boolean;
}

export const DeleteGroupModal: React.FC<Props> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  isOwner,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const ts = Date.now();
      const payload = isOwner
        ? `echo-delete-group|${groupId}|${ts}`
        : `echo-leave-group|${groupId}|${ts}`;

      const signed = await window.echoApi?.signPayload(payload);
      if (!signed) {
        throw new Error('İmzalama başarısız oldu');
      }

      const url = isOwner
        ? `${SERVER_HTTP_URL}/api/groups/${groupId}`
        : `${SERVER_HTTP_URL}/api/groups/${groupId}/leave`;

      const method = isOwner ? 'DELETE' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: signed.pubkey,
          ts,
          sig: signed.sig,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? (isOwner ? 'Grup silinemedi' : 'Gruptan ayrılamadı'));
      }

      // Check if voice connection was in this group
      if (useVoiceStore.getState().currentChannelId) {
        webrtcService.leave();
      }

      // If this group was active, disconnect ws
      if (useChatStore.getState().activeGroupId === groupId) {
        wsService.disconnect();
      }

      // Remove from store and local storage
      useChatStore.getState().removeGroup(groupId);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isOwner ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
            }`}
          >
            {isOwner ? <Trash2 className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {isOwner ? 'Grubu Kalıcı Olarak Sil' : 'Gruptan Ayrıl'}
            </h2>
            <p className="text-xs text-slate-400">
              {isOwner ? 'Bu işlem geri alınamaz' : 'Tekrar katılmak için davet gerekir'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-lg bg-slate-950/60 border border-slate-800 p-4 text-xs leading-relaxed text-slate-300">
          {isOwner ? (
            <div className="space-y-2">
              <p>
                <strong className="text-white font-semibold">"{groupName}"</strong> grubunu silmek
                istediğinizden emin misiniz?
              </p>
              <div className="flex items-start gap-2 text-rose-400/90 text-[11px] mt-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Tüm kanallar, ses odaları, davet kodları ve mesaj geçmişi kalıcı olarak yok
                  edilecektir. Bu işlem geri alınamaz.
                </span>
              </div>
            </div>
          ) : (
            <p>
              <strong className="text-white font-semibold">"{groupName}"</strong> grubundan ayrılmak
              istediğinizden emin misiniz?
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50 shadow-md ${
              isOwner
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
            }`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>
              {loading
                ? isOwner
                  ? 'Siliniyor...'
                  : 'Ayrılınıyor...'
                : isOwner
                  ? 'Grubu Sil'
                  : 'Gruptan Ayrıl'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
