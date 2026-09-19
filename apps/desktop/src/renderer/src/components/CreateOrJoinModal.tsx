import React, { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { wsService } from '../services/websocket';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrJoinModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { identity } = useAuthStore();
  const { addGroup, setActiveGroup, setDefaultInviteCode } = useChatStore();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity || !groupName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const ts = Date.now();
      const payload = `echo-create-group|${groupName.trim()}|${ts}`;
      const signed = await window.echoApi?.signPayload(payload);
      if (!signed) throw new Error('İmzalama başarısız oldu');

      const res = await fetch('http://localhost:8787/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          displayName: identity.displayName,
          pubkey: identity.publicKeyHex,
          ts,
          sig: signed.sig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Grup oluşturulamadı');
      }

      addGroup({ id: data.groupId, name: data.name });
      setActiveGroup(data.groupId);
      setDefaultInviteCode(data.inviteCode);
      wsService.connect(data.groupId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity || !inviteCode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const code = inviteCode.trim();
      const ts = Date.now();
      const payload = `echo-join-group|${code}|${ts}`;
      const signed = await window.echoApi?.signPayload(payload);
      if (!signed) throw new Error('İmzalama başarısız oldu');

      const res = await fetch('http://localhost:8787/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: code,
          displayName: identity.displayName,
          pubkey: identity.publicKeyHex,
          ts,
          sig: signed.sig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Gruba katılınamadı');
      }

      const grp = data.snapshot.group;
      addGroup({ id: grp.id, name: grp.name });
      setActiveGroup(grp.id);
      wsService.connect(grp.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex border-b border-slate-800 pb-3 mb-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'create'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Grup Oluştur
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('join');
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'join'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Davetle Katıl
          </button>
        </div>

        {activeTab === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Grup Adı
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Örn: Oyun Ekibi"
                maxLength={50}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>

            {error && <div className="text-xs text-rose-400">{error}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading || !groupName.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Oluşturuluyor...' : 'Grup Oluştur'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Davet Kodu
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Örn: ECHO-XXXX-XXXX"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                autoFocus
              />
            </div>

            {error && <div className="text-xs text-rose-400">{error}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Katılınıyor...' : 'Gruba Katıl'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
