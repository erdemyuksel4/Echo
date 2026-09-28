import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { SERVER_HTTP_URL } from '../config';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useDmStore } from '../stores/useDmStore';
import { wsService } from '../services/websocket';
export const CreateOrJoinModal = ({ isOpen, onClose }) => {
    const { identity } = useAuthStore();
    const { addGroup, setActiveGroup, setDefaultInviteCode } = useChatStore();
    const [activeTab, setActiveTab] = useState('create');
    const [groupName, setGroupName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    if (!isOpen)
        return null;
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!identity || !groupName.trim())
            return;
        setLoading(true);
        setError(null);
        try {
            const ts = Date.now();
            const payload = `echo-create-group|${groupName.trim()}|${ts}`;
            const signed = await window.echoApi?.signPayload(payload);
            if (!signed)
                throw new Error('İmzalama başarısız oldu');
            const res = await fetch(`${SERVER_HTTP_URL}/api/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: groupName.trim(),
                    ownerDisplayName: identity.displayName,
                    ownerPubkey: identity.publicKeyHex,
                    ts,
                    sig: signed.sig,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error ?? 'Grup oluşturulamadı');
            }
            useDmStore.getState().setActivePeer(null);
            addGroup({ id: data.groupId, name: data.name });
            setActiveGroup(data.groupId);
            setDefaultInviteCode(data.inviteCode);
            wsService.connect(data.groupId);
            setGroupName('');
            setError(null);
            onClose();
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Bir hata oluştu';
            if (msg.toLowerCase().includes('fetch') || msg.includes('Failed to fetch')) {
                setError('Sunucuya bağlanılamadı. Lütfen sunucunun (pnpm dev:server) çalıştığından emin olun.');
            }
            else {
                setError(msg);
            }
        }
        finally {
            setLoading(false);
        }
    };
    const handleJoin = async (e) => {
        e.preventDefault();
        if (!identity || !inviteCode.trim())
            return;
        setLoading(true);
        setError(null);
        try {
            const code = inviteCode.trim();
            const ts = Date.now();
            const payload = `echo-join-group|${code}|${ts}`;
            const signed = await window.echoApi?.signPayload(payload);
            if (!signed)
                throw new Error('İmzalama başarısız oldu');
            const res = await fetch(`${SERVER_HTTP_URL}/api/groups/join`, {
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
            useDmStore.getState().setActivePeer(null);
            addGroup({ id: grp.id, name: grp.name });
            useChatStore.getState().setSnapshot(grp, data.snapshot.channels, data.snapshot.members, data.snapshot.inviteCode ?? code);
            setActiveGroup(grp.id);
            setDefaultInviteCode(data.snapshot.inviteCode ?? code);
            wsService.connect(grp.id);
            setInviteCode('');
            setError(null);
            onClose();
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Bir hata oluştu';
            if (msg.toLowerCase().includes('fetch') || msg.includes('Failed to fetch')) {
                setError('Sunucuya bağlanılamadı. Lütfen sunucunun (pnpm dev:server) çalıştığından emin olun.');
            }
            else {
                setError(msg);
            }
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl", children: [_jsxs("div", { className: "flex border-b border-slate-800 pb-3 mb-4", children: [_jsx("button", { type: "button", onClick: () => {
                                setActiveTab('create');
                                setError(null);
                            }, className: `flex-1 py-2 text-sm font-semibold transition-colors ${activeTab === 'create'
                                ? 'text-indigo-400 border-b-2 border-indigo-500'
                                : 'text-slate-400 hover:text-white'}`, children: "Grup Olu\u015Ftur" }), _jsx("button", { type: "button", onClick: () => {
                                setActiveTab('join');
                                setError(null);
                            }, className: `flex-1 py-2 text-sm font-semibold transition-colors ${activeTab === 'join'
                                ? 'text-indigo-400 border-b-2 border-indigo-500'
                                : 'text-slate-400 hover:text-white'}`, children: "Davetle Kat\u0131l" })] }), activeTab === 'create' ? (_jsxs("form", { onSubmit: handleCreate, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1", children: "Grup Ad\u0131" }), _jsx("input", { type: "text", value: groupName, onChange: (e) => setGroupName(e.target.value), placeholder: "\u00D6rn: Oyun Ekibi", maxLength: 50, className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none", autoFocus: true })] }), error && _jsx("div", { className: "text-xs text-rose-400", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:text-white", children: "\u0130ptal" }), _jsx("button", { type: "submit", disabled: loading || !groupName.trim(), className: "rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50", children: loading ? 'Oluşturuluyor...' : 'Grup Oluştur' })] })] })) : (_jsxs("form", { onSubmit: handleJoin, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1", children: "Davet Kodu" }), _jsx("input", { type: "text", value: inviteCode, onChange: (e) => setInviteCode(e.target.value), placeholder: "\u00D6rn: ECHO-XXXX-XXXX", className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono", autoFocus: true })] }), error && _jsx("div", { className: "text-xs text-rose-400", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:text-white", children: "\u0130ptal" }), _jsx("button", { type: "submit", disabled: loading || !inviteCode.trim(), className: "rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50", children: loading ? 'Katılınıyor...' : 'Gruba Katıl' })] })] }))] }) }));
};
