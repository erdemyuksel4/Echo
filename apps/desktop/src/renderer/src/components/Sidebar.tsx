import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useDmStore } from '../stores/useDmStore';
import { wsService } from '../services/websocket';
import { DeleteGroupModal } from './DeleteGroupModal';

interface Props {
  onOpenCreateModal: () => void;
}

export const Sidebar: React.FC<Props> = ({ onOpenCreateModal }) => {
  const { identity } = useAuthStore();
  const { groups, activeGroupId, activeGroupMeta, setActiveGroup } = useChatStore();
  const [contextMenu, setContextMenu] = useState<{
    groupId: string;
    groupName: string;
    x: number;
    y: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    groupId: string;
    groupName: string;
    isOwner: boolean;
  } | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleSelectGroup = (groupId: string) => {
    useDmStore.getState().setActivePeer(null);
    setActiveGroup(groupId);
    wsService.connect(groupId);
  };

  return (
    <div className="flex h-full w-[72px] flex-col items-center bg-slate-950 py-3 gap-2 border-r border-slate-800/60 select-none">
      {/* Home / Echo Icon */}
      <button
        onClick={() => {
          useDmStore.getState().setActivePeer(null);
          setActiveGroup(null);
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
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  groupId: group.id,
                  groupName: group.name,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg bg-slate-950 p-1.5 border border-slate-800 shadow-2xl min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 truncate max-w-[160px] border-b border-slate-800 mb-1">
            {contextMenu.groupName}
          </div>
          {(() => {
            const targetGroup = groups.find((g) => g.id === contextMenu.groupId);
            const isOwner =
              targetGroup?.ownerId === identity?.userId ||
              (activeGroupId === contextMenu.groupId &&
                activeGroupMeta?.ownerId === identity?.userId);

            return (
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget({
                    groupId: contextMenu.groupId,
                    groupName: contextMenu.groupName,
                    isOwner: !!isOwner,
                  });
                  setContextMenu(null);
                }}
                className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs transition font-medium ${
                  isOwner
                    ? 'text-rose-400 hover:bg-rose-500/20'
                    : 'text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                <span>{isOwner ? 'Grubu Sil' : 'Gruptan Ayrıl'}</span>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            );
          })()}
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {deleteTarget && (
        <DeleteGroupModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          groupId={deleteTarget.groupId}
          groupName={deleteTarget.groupName}
          isOwner={deleteTarget.isOwner}
        />
      )}
    </div>
  );
};
