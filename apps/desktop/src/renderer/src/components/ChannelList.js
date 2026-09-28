import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Hash, Volume2, Plus, Share2, Check, Settings, MicOff, VolumeX, ChevronDown, Trash2, LogOut, MessageSquare, Radio, Video, Info, } from 'lucide-react';
import { UserAudioState, computeAudioState } from '@echo/shared';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useDmStore } from '../stores/useDmStore';
import { useScreenShareStore } from '../stores/useScreenShareStore';
import { wsService } from '../services/websocket';
import { webrtcService } from '../services/webrtc';
import { SettingsModal } from './SettingsModal';
import { VoicePanel } from './VoicePanel';
import { DeleteGroupModal } from './DeleteGroupModal';
import { SERVER_HTTP_URL } from '../config';
export const ChannelList = () => {
    const { identity } = useAuthStore();
    const { activeGroupId, activeGroupMeta, channels, activeChannelId, setActiveChannel, defaultInviteCode, unreadCounts, } = useChatStore();
    const { currentChannelId, channelParticipants, audioState } = useVoiceStore();
    const [copied, setCopied] = useState(false);
    const [showAddChannel, setShowAddChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelType, setNewChannelType] = useState('text');
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState('voice');
    const openSettings = (tab = 'voice') => {
        setSettingsTab(tab);
        setShowSettings(true);
    };
    const [showGroupMenu, setShowGroupMenu] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const isOwner = activeGroupMeta ? identity?.userId === activeGroupMeta.ownerId : false;
    const { threads, activePeer, setActivePeer } = useDmStore();
    const { activeShares, watchStream } = useScreenShareStore();
    if (!activeGroupId) {
        return (_jsxs("div", { className: "flex h-full w-60 flex-col bg-slate-900 border-r border-slate-800/60 select-none", children: [_jsx("div", { className: "flex h-14 items-center border-b border-slate-800/80 px-4 shadow-sm", children: _jsx("h1", { className: "font-bold text-white text-sm", children: "Direkt Mesajlar" }) }), _jsxs("div", { className: "flex-1 overflow-y-auto px-2 py-3 space-y-1", children: [_jsxs("button", { onClick: () => {
                                useChatStore.getState().setActiveGroup(null);
                                setActivePeer(null);
                            }, className: `w-full rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2.5 transition text-left ${!activePeer
                                ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'}`, children: [_jsx(MessageSquare, { className: "h-4 w-4 text-indigo-400" }), _jsx("span", { children: "Ana Sayfa & Arkada\u015Flar" })] }), _jsxs("div", { className: "pt-4 px-2", children: [_jsxs("div", { className: "flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2", children: [_jsx("span", { children: "Direkt Mesajlar" }), threads.length > 0 && _jsxs("span", { children: ["(", threads.length, ")"] })] }), threads.length === 0 ? (_jsx("p", { className: "text-[11px] text-slate-500 leading-relaxed px-1", children: "Hen\u00FCz aktif direkt mesaj\u0131n\u0131z yok. Bir gruptan arkada\u015F se\u00E7ip mesaj g\u00F6nderebilirsiniz." })) : (_jsx("div", { className: "space-y-0.5", children: threads.map((thread) => {
                                        const isActive = activePeer?.peerId === thread.peerId;
                                        return (_jsxs("button", { onClick: () => {
                                                useChatStore.getState().setActiveGroup(null);
                                                setActivePeer({
                                                    peerId: thread.peerId,
                                                    peerName: thread.peerName,
                                                    peerColor: thread.peerColor,
                                                });
                                            }, className: `group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${isActive
                                                ? 'bg-slate-800 text-white font-medium'
                                                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`, children: [_jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [_jsx("div", { className: "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow", style: { backgroundColor: thread.peerColor || '#6366f1' }, children: thread.peerName.charAt(0).toUpperCase() }), _jsx("span", { className: "truncate text-xs", children: thread.peerName })] }), thread.unreadCount > 0 && (_jsx("span", { className: "flex-shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-bold text-white", children: thread.unreadCount }))] }, thread.peerId));
                                    }) }))] })] }), _jsx(VoicePanel, {}), _jsxs("div", { className: "flex h-14 items-center bg-slate-950/80 px-3 border-t border-slate-800/60", children: [_jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow", style: { backgroundColor: identity?.avatarColor ?? '#4f46e5' }, children: identity?.displayName.charAt(0).toUpperCase() }), _jsxs("div", { className: "ml-2.5 flex-1 min-w-0", children: [_jsx("div", { className: "truncate text-xs font-semibold text-white", children: identity?.displayName }), _jsx("div", { className: "text-[10px] text-emerald-400", children: "\u00C7evrimi\u00E7i" })] }), _jsxs("div", { className: "flex items-center gap-0.5", children: [_jsx("button", { onClick: () => openSettings('about'), className: "rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition", title: "Echo Hakk\u0131nda & S\u00FCr\u00FCm Bilgileri", children: _jsx(Info, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => openSettings('voice'), className: "rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition", title: "Ayarlar", children: _jsx(Settings, { className: "h-4 w-4" }) })] })] }), _jsx(SettingsModal, { isOpen: showSettings, onClose: () => setShowSettings(false), initialTab: settingsTab })] }));
    }
    const handleCopyInvite = async () => {
        let code = defaultInviteCode;
        if (!code && activeGroupMeta?.id) {
            try {
                const res = await fetch(`${SERVER_HTTP_URL}/api/groups/${activeGroupMeta.id}/invite`);
                if (res.ok) {
                    const data = (await res.json());
                    if (data.inviteCode) {
                        code = data.inviteCode;
                        useChatStore.getState().setDefaultInviteCode(code);
                    }
                }
            }
            catch {
                // ignore
            }
        }
        if (!code && activeGroupMeta?.id) {
            code = `ECHO-${activeGroupMeta.id.toLowerCase()}`;
        }
        if (!code)
            return;
        let success = false;
        if (window.echoApi?.copyToClipboard) {
            try {
                success = await window.echoApi.copyToClipboard(code);
            }
            catch (err) {
                console.warn('Native clipboard copy failed:', err);
            }
        }
        if (!success) {
            try {
                await navigator.clipboard.writeText(code);
                success = true;
            }
            catch (err) {
                console.warn('navigator.clipboard failed:', err);
                const textArea = document.createElement('textarea');
                textArea.value = code;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    success = document.execCommand('copy');
                }
                catch (_e) {
                    void _e;
                }
                document.body.removeChild(textArea);
            }
        }
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    const handleCreateChannel = (e) => {
        e.preventDefault();
        if (!newChannelName.trim())
            return;
        wsService.createChannel(newChannelName, newChannelType);
        setNewChannelName('');
        setShowAddChannel(false);
    };
    const textChannels = channels.filter((c) => c.type === 'text');
    const voiceChannels = channels.filter((c) => c.type === 'voice');
    if (!activeGroupMeta) {
        return (_jsxs("div", { className: "flex h-full w-60 flex-col bg-slate-900 border-r border-slate-800/60 select-none", children: [_jsx("div", { className: "flex h-14 items-center border-b border-slate-800/80 px-4 shadow-sm animate-pulse", children: _jsx("div", { className: "h-4 w-28 bg-slate-800 rounded" }) }), _jsxs("div", { className: "flex-1 p-3 space-y-2", children: [_jsx("div", { className: "h-3 w-16 bg-slate-800/60 rounded" }), _jsx("div", { className: "h-6 w-full bg-slate-800/40 rounded" }), _jsx("div", { className: "h-6 w-full bg-slate-800/40 rounded" })] }), _jsx(VoicePanel, {})] }));
    }
    return (_jsxs("div", { className: "flex h-full w-60 flex-col bg-slate-900 border-r border-slate-800/60 select-none", children: [_jsxs("div", { className: "relative border-b border-slate-800/80", children: [_jsxs("div", { className: "flex h-14 w-full items-center justify-between px-3", children: [_jsxs("button", { type: "button", onClick: () => setShowGroupMenu((prev) => !prev), className: "flex items-center gap-1.5 min-w-0 flex-1 px-1.5 py-1.5 rounded-md hover:bg-slate-800/50 transition text-left", children: [_jsx("h1", { className: "truncate font-bold text-white text-sm", title: activeGroupMeta.name, children: activeGroupMeta.name }), _jsx(ChevronDown, { className: `h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${showGroupMenu ? 'rotate-180 text-white' : ''}` })] }), _jsxs("button", { type: "button", onClick: handleCopyInvite, className: `flex items-center gap-1 shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition ${copied
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'}`, title: defaultInviteCode
                                    ? `Davet Kodunu Kopyala (${defaultInviteCode})`
                                    : 'Davet Kodunu Kopyala', children: [copied ? (_jsx(Check, { className: "h-3.5 w-3.5 text-emerald-400" })) : (_jsx(Share2, { className: "h-3.5 w-3.5 text-indigo-400" })), _jsx("span", { children: copied ? 'Kopyalandı!' : 'Davet' })] })] }), showGroupMenu && (_jsxs("div", { className: "absolute left-2 right-2 top-14 z-40 rounded-lg bg-slate-950 p-2 border border-slate-800 shadow-2xl space-y-1.5", children: [_jsxs("div", { className: "rounded-md bg-slate-900/90 p-2 border border-slate-800/80", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-[10px] uppercase font-semibold text-slate-400 tracking-wider", children: "Grup Davet Kodu" }), copied && (_jsx("span", { className: "text-[10px] text-emerald-400 font-medium", children: "Kopyaland\u0131!" }))] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("div", { className: "flex-1 truncate rounded bg-slate-950 px-2 py-1 font-mono text-xs text-indigo-300 border border-slate-800 select-all", children: defaultInviteCode || `ECHO-${activeGroupMeta.id.toLowerCase()}` }), _jsx("button", { type: "button", onClick: handleCopyInvite, className: "shrink-0 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 transition shadow", children: copied ? _jsx(Check, { className: "h-3.5 w-3.5" }) : 'Kopyala' })] })] }), _jsx("div", { className: "h-px bg-slate-800/80 my-1" }), _jsxs("button", { type: "button", onClick: () => {
                                    setShowGroupMenu(false);
                                    setShowAddChannel(true);
                                }, className: "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition", children: [_jsx("span", { children: "Kanal Ekle" }), _jsx(Plus, { className: "h-3.5 w-3.5 text-slate-400" })] }), _jsx("div", { className: "h-px bg-slate-800/80 my-1" }), isOwner ? (_jsxs("button", { type: "button", onClick: () => {
                                    setShowGroupMenu(false);
                                    setShowDeleteModal(true);
                                }, className: "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20 transition font-medium", children: [_jsx("span", { children: "Grubu Sil" }), _jsx(Trash2, { className: "h-3.5 w-3.5 text-rose-400" })] })) : (_jsxs("button", { type: "button", onClick: () => {
                                    setShowGroupMenu(false);
                                    setShowDeleteModal(true);
                                }, className: "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition font-medium", children: [_jsx("span", { children: "Gruptan Ayr\u0131l" }), _jsx(LogOut, { className: "h-3.5 w-3.5 text-amber-400" })] }))] }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-2 py-3 space-y-4", children: [showAddChannel && (_jsx("div", { className: "rounded-lg bg-slate-950 p-2.5 border border-slate-800 shadow-md", children: _jsxs("form", { onSubmit: handleCreateChannel, className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-[11px] font-semibold text-slate-300", children: [_jsx("span", { children: "Yeni Kanal Ekle" }), _jsx("button", { type: "button", onClick: () => setShowAddChannel(false), className: "text-slate-500 hover:text-slate-300", children: "\u2715" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => setNewChannelType('text'), className: `flex-1 rounded py-1 text-[11px] font-medium transition ${newChannelType === 'text'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-800 text-slate-400 hover:text-white'}`, children: "# Metin" }), _jsx("button", { type: "button", onClick: () => setNewChannelType('voice'), className: `flex-1 rounded py-1 text-[11px] font-medium transition ${newChannelType === 'voice'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-800 text-slate-400 hover:text-white'}`, children: "\uD83D\uDD0A Sesli" })] }), _jsx("input", { type: "text", value: newChannelName, onChange: (e) => setNewChannelName(e.target.value), placeholder: newChannelType === 'text' ? 'kanal-adı' : 'Ses Kanalı Adı', className: "w-full rounded bg-slate-900 px-2 py-1 text-xs text-white placeholder-slate-500 border border-slate-700 focus:outline-none focus:border-indigo-500", autoFocus: true }), _jsx("button", { type: "submit", className: "w-full rounded bg-indigo-600 py-1 text-xs font-semibold text-white hover:bg-indigo-500 transition", children: "Olu\u015Ftur" })] }) })), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400", children: [_jsx("span", { children: "Metin Kanallar\u0131" }), _jsx("button", { onClick: () => {
                                            setNewChannelType('text');
                                            setShowAddChannel(true);
                                        }, className: "text-slate-400 hover:text-white", title: "Metin Kanal\u0131 Ekle", children: _jsx(Plus, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "mt-1 space-y-0.5", children: textChannels.map((channel) => {
                                    const isActive = activeChannelId === channel.id;
                                    const unread = unreadCounts[channel.id] ?? 0;
                                    return (_jsxs("button", { onClick: () => {
                                            setActiveChannel(channel.id);
                                            wsService.fetchHistory(channel.id);
                                        }, className: `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition ${isActive
                                            ? 'bg-slate-800 text-white'
                                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`, children: [_jsx(Hash, { className: "h-4 w-4 text-slate-400 flex-shrink-0" }), _jsx("span", { className: "truncate", children: channel.name }), unread > 0 && !isActive && (_jsx("span", { className: "ml-auto rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-bold text-white shadow", children: unread }))] }, channel.id));
                                }) })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400", children: [_jsx("span", { children: "Ses Kanallar\u0131" }), _jsx("button", { onClick: () => {
                                            setNewChannelType('voice');
                                            setShowAddChannel(true);
                                        }, className: "text-slate-400 hover:text-white", title: "Ses Kanal\u0131 Ekle", children: _jsx(Plus, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "mt-1 space-y-1", children: voiceChannels.map((channel) => {
                                    const isVoiceActive = currentChannelId === channel.id;
                                    const participants = channelParticipants[channel.id] ?? [];
                                    return (_jsxs("div", { className: "space-y-0.5", children: [_jsxs("button", { onClick: () => {
                                                    if (!isVoiceActive && activeGroupMeta) {
                                                        void webrtcService.join(activeGroupMeta.id, activeGroupMeta.name, channel.id, channel.name);
                                                    }
                                                    setActiveChannel(channel.id);
                                                }, className: `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition group ${activeChannelId === channel.id
                                                    ? 'bg-slate-800 text-white font-semibold'
                                                    : isVoiceActive
                                                        ? 'bg-emerald-950/40 text-emerald-300 font-semibold border border-emerald-800/40'
                                                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`, children: [_jsx(Volume2, { className: `h-4 w-4 flex-shrink-0 ${isVoiceActive
                                                            ? 'text-emerald-400'
                                                            : 'text-slate-400 group-hover:text-slate-300'}` }), _jsx("span", { className: "truncate", children: channel.name }), participants.length > 0 && (_jsxs("span", { className: "ml-auto text-[10px] font-mono rounded bg-slate-800 px-1.5 py-0.2 text-slate-400", children: [participants.length, "/10"] }))] }), participants.length > 0 && (_jsx("div", { className: "pl-4 pr-1 py-1 space-y-1", children: participants.map((p) => {
                                                    const isLocal = p.userId === identity?.userId;
                                                    const pAudioState = isLocal
                                                        ? audioState
                                                        : computeAudioState({ muted: p.muted, deafened: p.deafened, speaking: p.speaking });
                                                    const speaking = pAudioState === UserAudioState.SPEAKING;
                                                    const muted = pAudioState === UserAudioState.MUTED;
                                                    const deafened = pAudioState === UserAudioState.DEAFENED;
                                                    return (_jsxs("div", { className: "flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/40 transition", children: [_jsx("div", { className: "relative flex items-center justify-center", children: _jsx("div", { className: `flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white transition-all duration-150 ${speaking
                                                                        ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900 shadow-sm shadow-emerald-400/80 scale-105'
                                                                        : ''}`, style: { backgroundColor: '#4f46e5' }, children: p.displayName.charAt(0).toUpperCase() }) }), _jsxs("span", { className: `truncate text-xs ${speaking ? 'text-emerald-300 font-semibold' : 'text-slate-300'}`, children: [p.displayName, " ", isLocal && '(Sen)'] }), activeShares.some((s) => s.channelId === channel.id && s.userId === p.userId) && (_jsxs("button", { onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    setActiveChannel(channel.id);
                                                                    if (!isLocal) {
                                                                        void watchStream(p.userId, p.displayName, channel.id);
                                                                    }
                                                                }, className: `flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold transition shadow-sm ${isLocal
                                                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-default'
                                                                    : 'bg-rose-600 text-white hover:bg-rose-500 animate-pulse cursor-pointer'}`, title: isLocal ? 'Ekranını paylaşıyorsun' : 'Yayını İzle', children: [_jsx(Radio, { className: "h-2.5 w-2.5" }), _jsx("span", { children: "CANLI" })] })), _jsxs("div", { className: "ml-auto flex items-center gap-1", children: [p.camera && (_jsx("span", { title: "Kamera a\u00E7\u0131k", children: _jsx(Video, { className: "h-3 w-3 text-emerald-400" }) })), muted && (_jsx("span", { title: "Mikrofon kapal\u0131", children: _jsx(MicOff, { className: "h-3 w-3 text-rose-400" }) })), deafened && (_jsx("span", { title: "Kulakl\u0131k kapal\u0131", children: _jsx(VolumeX, { className: "h-3 w-3 text-rose-400" }) }))] })] }, p.userId));
                                                }) }))] }, channel.id));
                                }) })] })] }), _jsx(VoicePanel, {}), _jsxs("div", { className: "flex h-14 items-center bg-slate-950/80 px-3 border-t border-slate-800/60", children: [_jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow", style: { backgroundColor: identity?.avatarColor ?? '#4f46e5' }, children: identity?.displayName.charAt(0).toUpperCase() }), _jsxs("div", { className: "ml-2.5 flex-1 min-w-0", children: [_jsx("div", { className: "truncate text-xs font-semibold text-white", children: identity?.displayName }), _jsx("div", { className: "text-[10px] text-emerald-400", children: "\u00C7evrimi\u00E7i" })] }), _jsxs("div", { className: "flex items-center gap-0.5", children: [_jsx("button", { onClick: () => openSettings('about'), className: "rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition", title: "Echo Hakk\u0131nda & S\u00FCr\u00FCm Bilgileri", children: _jsx(Info, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => openSettings('voice'), className: "rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition", title: "Ayarlar", children: _jsx(Settings, { className: "h-4 w-4" }) })] })] }), _jsx(SettingsModal, { isOpen: showSettings, onClose: () => setShowSettings(false), initialTab: settingsTab }), activeGroupMeta && (_jsx(DeleteGroupModal, { isOpen: showDeleteModal, onClose: () => setShowDeleteModal(false), groupId: activeGroupMeta.id, groupName: activeGroupMeta.name, isOwner: isOwner }))] }));
};
