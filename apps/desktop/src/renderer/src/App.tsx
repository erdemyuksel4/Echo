import React, { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { useAuthStore } from './stores/useAuthStore';
import { useChatStore } from './stores/useChatStore';
import { OnboardingModal } from './components/OnboardingModal';
import { Sidebar } from './components/Sidebar';
import { ChannelList } from './components/ChannelList';
import { ChatArea } from './components/ChatArea';
import { MemberList } from './components/MemberList';
import { DirectMessagesView } from './components/DirectMessagesView';
import { CreateOrJoinModal } from './components/CreateOrJoinModal';
import { webrtcService } from './services/webrtc';

import { wsService } from './services/websocket';
import { dmWebSocketService } from './services/dmWebsocket';

export const App: React.FC = () => {
  const { identity, isLoaded, loadIdentity } = useAuthStore();
  const { activeGroupId } = useChatStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    if (!identity) return;

    void fetch(`http://localhost:8787/api/users/${identity.userId}/groups`)
      .then((res) => (res.ok ? res.json() : []))
      .then((serverGroups: { id: string; name: string }[]) => {
        if (serverGroups && serverGroups.length > 0) {
          const currentGroups = useChatStore.getState().groups;
          const merged = [...currentGroups];
          for (const sg of serverGroups) {
            const idx = merged.findIndex((g) => g.id === sg.id);
            if (idx === -1) {
              merged.push(sg);
            } else {
              merged[idx] = sg; // Update name if changed
            }
          }
          useChatStore.getState().setGroups(merged);

          const currentActive = useChatStore.getState().activeGroupId;
          const targetId =
            currentActive && merged.some((g) => g.id === currentActive)
              ? currentActive
              : merged[0]!.id;
          useChatStore.getState().setActiveGroup(targetId);
          wsService.connect(targetId);
        } else {
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
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-slate-100 select-none">
        <div className="relative flex flex-col items-center space-y-6">
          {/* Logo with outer glow */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600/20 border border-indigo-500/40 shadow-2xl shadow-indigo-500/20">
            <Radio className="h-10 w-10 text-indigo-400 animate-pulse" />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-black tracking-wider text-white">ECHO</h1>
            <p className="text-xs text-slate-400 font-medium">Güvenli, Dağıtık ve Kesintisiz İletişim</p>
          </div>

          {/* Polished Discord-like Progress Bar */}
          <div className="w-64 space-y-2">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/40 shadow-inner relative">
              <div className="h-full w-1/2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full animate-indeterminate" />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium px-1">
              <span>Yükleniyor...</span>
              <span className="text-indigo-400/80">Kimlik Doğrulanıyor</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 select-none">
      {!identity && <OnboardingModal />}

      {/* Main Application Layout */}
      <Sidebar onOpenCreateModal={() => setShowCreateModal(true)} />
      <ChannelList />
      {activeGroupId ? (
        <>
          <ChatArea />
          <MemberList />
        </>
      ) : (
        <DirectMessagesView />
      )}

      <CreateOrJoinModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
};

export default App;
