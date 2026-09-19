import React from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { wsService } from '../services/websocket';

interface Props {
  onOpenCreateModal: () => void;
}

export const Sidebar: React.FC<Props> = ({ onOpenCreateModal }) => {
  const { groups, activeGroupId, setActiveGroup } = useChatStore();

  const handleSelectGroup = (groupId: string) => {
    setActiveGroup(groupId);
    wsService.connect(groupId);
  };

  return (
    <div className="flex h-full w-[72px] flex-col items-center bg-slate-950 py-3 gap-2 border-r border-slate-800/60 select-none">
      {/* Home / Echo Icon */}
      <button
        onClick={() => {
          setActiveGroup(null);
          useChatStore.getState().setActiveChannel(null);
          useChatStore.setState({ activeGroupMeta: null });
          wsService.disconnect();
        }}
        className={`group relative flex h-12 w-12 items-center justify-center rounded-3xl transition-all duration-200 hover:rounded-2xl ${
          activeGroupId === null
            ? 'bg-indigo-600 rounded-2xl text-white'
            : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white'
        }`}
        title="Ana Sayfa"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      <div className="h-[2px] w-8 rounded bg-slate-800" />

      {/* Group List */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden w-full items-center">
        {groups.map((group) => {
          const isActive = activeGroupId === group.id;
          const initial = group.name.charAt(0).toUpperCase();

          return (
            <button
              key={group.id}
              onClick={() => handleSelectGroup(group.id)}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-3xl text-sm font-bold transition-all duration-200 hover:rounded-2xl ${
                isActive
                  ? 'bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title={group.name}
            >
              {initial}
              {/* Active Indicator Bar */}
              {isActive && <span className="absolute -left-1.5 h-8 w-1.5 rounded-r bg-white" />}
            </button>
          );
        })}

        {/* Add / Join Group Button */}
        <button
          onClick={onOpenCreateModal}
          className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-800 text-emerald-400 transition-all duration-200 hover:rounded-2xl hover:bg-emerald-600 hover:text-white"
          title="Grup Ekle veya Katıl"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};
