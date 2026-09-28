import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Radio, WifiOff, Loader2 } from 'lucide-react';
import { useAuthStore } from './stores/useAuthStore';
import { useChatStore } from './stores/useChatStore';
import { useVoiceStore } from './stores/useVoiceStore';
import { OnboardingModal } from './components/OnboardingModal';
import { Sidebar } from './components/Sidebar';
import { ChannelList } from './components/ChannelList';
import { ChatArea } from './components/ChatArea';
import { MemberList } from './components/MemberList';
import { DirectMessagesView } from './components/DirectMessagesView';
import { CreateOrJoinModal } from './components/CreateOrJoinModal';
import { ScreenShareViewer } from './components/ScreenShareViewer';
import { VoiceStageView } from './components/VoiceStageView';
import { UpdateNotification } from './components/UpdateNotification';
import { webrtcService } from './services/webrtc';
import { SERVER_HTTP_URL } from './config';
import { wsService } from './services/websocket';
import { dmWebSocketService } from './services/dmWebsocket';
export const App = () => {
    const { identity, isLoaded, loadIdentity } = useAuthStore();
    const { activeGroupId, connectionStatus, channels, activeChannelId } = useChatStore();
    const activeChannel = channels.find((c) => c.id === activeChannelId);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { inputMode, pttKey, pttReleaseDelay, currentChannelId } = useVoiceStore();
    // Global Push-to-Talk keydown and keyup listeners
    useEffect(() => {
        let pttTimer = null;
        const handleKeyDown = (e) => {
            if (inputMode !== 'ptt' || !currentChannelId)
                return;
            const target = e.target;
            const isInput = target &&
                (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            const isModifier = [
                'ControlLeft',
                'ControlRight',
                'AltLeft',
                'AltRight',
                'ShiftLeft',
                'ShiftRight',
                'CapsLock',
            ].includes(e.code) || e.code.startsWith('F');
            if (isInput && !isModifier)
                return;
            if (e.code === pttKey) {
                if (pttTimer) {
                    clearTimeout(pttTimer);
                    pttTimer = null;
                }
                webrtcService.setPttActive(true);
            }
        };
        const handleKeyUp = (e) => {
            if (inputMode !== 'ptt' || !currentChannelId)
                return;
            if (e.code === pttKey) {
                if (pttTimer)
                    clearTimeout(pttTimer);
                pttTimer = setTimeout(() => {
                    webrtcService.setPttActive(false);
                    pttTimer = null;
                }, pttReleaseDelay);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (pttTimer)
                clearTimeout(pttTimer);
        };
    }, [inputMode, pttKey, pttReleaseDelay, currentChannelId]);
    useEffect(() => {
        loadIdentity();
        void webrtcService.init();
    }, [loadIdentity]);
    // Connect DM WebSocket as soon as identity is available
    useEffect(() => {
        if (identity) {
            dmWebSocketService.connect();
        }
    }, [identity]);
    // Load and sync user's groups on startup
    useEffect(() => {
        if (!identity)
            return;
        void fetch(`${SERVER_HTTP_URL}/api/users/${identity.userId}/groups`)
            .then((res) => (res.ok ? res.json() : []))
            .then((serverGroups) => {
            if (serverGroups && serverGroups.length > 0) {
                const currentGroups = useChatStore.getState().groups;
                const merged = [...currentGroups];
                for (const sg of serverGroups) {
                    const idx = merged.findIndex((g) => g.id === sg.id);
                    if (idx === -1) {
                        merged.push(sg);
                    }
                    else {
                        merged[idx] = sg; // Update name if changed
                    }
                }
                useChatStore.getState().setGroups(merged);
                const currentActive = useChatStore.getState().activeGroupId;
                const targetId = currentActive && merged.some((g) => g.id === currentActive)
                    ? currentActive
                    : merged[0].id;
                useChatStore.getState().setActiveGroup(targetId);
                wsService.connect(targetId);
            }
            else {
                const currentActive = useChatStore.getState().activeGroupId;
                if (currentActive) {
                    wsService.connect(currentActive);
                }
            }
        })
            .catch(() => {
            const currentActive = useChatStore.getState().activeGroupId;
            if (currentActive) {
                wsService.connect(currentActive);
            }
        });
    }, [identity]);
    if (!isLoaded) {
        return (_jsx("div", { className: "flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-slate-100 select-none", children: _jsxs("div", { className: "relative flex flex-col items-center space-y-6", children: [_jsx("div", { className: "relative flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600/20 border border-indigo-500/40 shadow-2xl shadow-indigo-500/20", children: _jsx(Radio, { className: "h-10 w-10 text-indigo-400 animate-pulse" }) }), _jsxs("div", { className: "text-center space-y-1", children: [_jsx("h1", { className: "text-2xl font-black tracking-wider text-white", children: "ECHO" }), _jsx("p", { className: "text-xs text-slate-400 font-medium", children: "G\u00FCvenli, Da\u011F\u0131t\u0131k ve Kesintisiz \u0130leti\u015Fim" })] }), _jsxs("div", { className: "w-64 space-y-2", children: [_jsx("div", { className: "h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/40 shadow-inner relative", children: _jsx("div", { className: "h-full w-1/2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full animate-indeterminate" }) }), _jsxs("div", { className: "flex justify-between items-center text-[11px] text-slate-500 font-medium px-1", children: [_jsx("span", { children: "Y\u00FCkleniyor..." }), _jsx("span", { className: "text-indigo-400/80", children: "Kimlik Do\u011Frulan\u0131yor" })] })] })] }) }));
    }
    return (_jsxs("div", { className: "flex h-screen w-screen flex-col overflow-hidden bg-slate-900 text-slate-100 select-none relative", children: [_jsx(UpdateNotification, {}), _jsxs("div", { className: "flex flex-1 min-h-0 w-full overflow-hidden relative", children: [!identity && _jsx(OnboardingModal, {}), activeGroupId && connectionStatus !== 'connected' && (_jsx("div", { className: "fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-500/90 backdrop-blur px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 animate-in fade-in slide-in-from-top-2", children: connectionStatus === 'connecting' ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin text-slate-950" }), _jsx("span", { children: "Sunucuya ba\u011Flan\u0131l\u0131yor..." })] })) : (_jsxs(_Fragment, { children: [_jsx(WifiOff, { className: "h-3.5 w-3.5 text-slate-950" }), _jsx("span", { children: "Ba\u011Flant\u0131 koptu, yeniden ba\u011Flan\u0131l\u0131yor..." })] })) })), _jsx(Sidebar, { onOpenCreateModal: () => setShowCreateModal(true) }), _jsx(ChannelList, {}), activeGroupId ? (_jsxs(_Fragment, { children: [activeChannel?.type === 'voice' ? (_jsx(VoiceStageView, { channel: activeChannel })) : (_jsx(ChatArea, {})), _jsx(MemberList, {})] })) : (_jsx(DirectMessagesView, {})), _jsx(CreateOrJoinModal, { isOpen: showCreateModal, onClose: () => setShowCreateModal(false) }), _jsx(ScreenShareViewer, {})] })] }));
};
export default App;
