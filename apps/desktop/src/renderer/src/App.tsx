import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/useAuthStore';
import { OnboardingModal } from './components/OnboardingModal';
import { Sidebar } from './components/Sidebar';
import { ChannelList } from './components/ChannelList';
import { ChatArea } from './components/ChatArea';
import { MemberList } from './components/MemberList';
import { CreateOrJoinModal } from './components/CreateOrJoinModal';

export const App: React.FC = () => {
  const { identity, isLoaded, loadIdentity } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-indigo-500 animate-ping" />
          <span className="text-sm font-medium">Echo Başlatılıyor...</span>
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
      <ChatArea />
      <MemberList />

      <CreateOrJoinModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
};

export default App;
