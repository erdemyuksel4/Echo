import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Crown, Shield, MessageSquare } from 'lucide-react';
import { UserAudioState, computeAudioState } from '@echo/shared';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useDmStore } from '../stores/useDmStore';
import { wsService } from '../services/websocket';
export const MemberList = () => {
    const { members, activeGroupId } = useChatStore();
    const { identity } = useAuthStore();
    const { channelParticipants, audioState } = useVoiceStore();
    if (!activeGroupId)
        return null;
    const onlineMembers = members.filter((m) => m.status === 'online');
    const offlineMembers = members.filter((m) => m.status !== 'online');
    const renderMember = (member) => {
        const avatarColor = member.pubkey ? '#' + member.pubkey.substring(0, 6) : '#6366f1';
        const isLocal = member.userId === identity?.userId;
        const isSpeakingMember = isLocal
            ? audioState === UserAudioState.SPEAKING
            : Object.values(channelParticipants).some((list) => list.some((p) => p.userId === member.userId &&
                computeAudioState(p) === UserAudioState.SPEAKING));
        return (_jsxs("div", { className: "flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-slate-800/40", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: `flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white shadow transition-all duration-150 ${isSpeakingMember
                                ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-950 shadow-sm shadow-emerald-400/80 scale-105'
                                : ''}`, style: { backgroundColor: avatarColor }, children: member.displayName.charAt(0).toUpperCase() }), _jsx("span", { className: `absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900 ${member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'}` })] }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: `truncate text-xs font-medium ${isSpeakingMember
                                    ? 'text-emerald-300 font-semibold'
                                    : member.status === 'online'
                                        ? 'text-slate-200'
                                        : 'text-slate-500'}`, children: member.displayName }), member.role === 'owner' && (_jsx("span", { title: "Sunucu Sahibi", children: _jsx(Crown, { className: "h-3.5 w-3.5 text-amber-400 flex-shrink-0" }) })), member.role === 'admin' && (_jsx("span", { title: "Y\u00F6netici", children: _jsx(Shield, { className: "h-3.5 w-3.5 text-indigo-400 flex-shrink-0" }) }))] }) }), !isLocal && (_jsx("button", { onClick: () => {
                        useDmStore.getState().setActivePeer({
                            peerId: member.userId,
                            peerName: member.displayName,
                            peerColor: avatarColor,
                        });
                        useChatStore.getState().setActiveGroup(null);
                        useChatStore.getState().setActiveChannel(null);
                        useChatStore.setState({ activeGroupMeta: null });
                        wsService.disconnect();
                    }, className: "rounded p-1 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition", title: "Mesaj G\u00F6nder", children: _jsx(MessageSquare, { className: "h-3.5 w-3.5" }) }))] }, member.userId));
    };
    return (_jsxs("div", { className: "flex h-full w-56 flex-col bg-slate-950/70 border-l border-slate-800/60 p-3 select-none overflow-y-auto", children: [onlineMembers.length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1", children: ["\u00C7evrimi\u00E7i \u2014 ", onlineMembers.length] }), _jsx("div", { className: "space-y-0.5", children: onlineMembers.map(renderMember) })] })), offlineMembers.length > 0 && (_jsxs("div", { children: [_jsxs("div", { className: "px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1", children: ["\u00C7evrimd\u0131\u015F\u0131 \u2014 ", offlineMembers.length] }), _jsx("div", { className: "space-y-0.5", children: offlineMembers.map(renderMember) })] }))] }));
};
