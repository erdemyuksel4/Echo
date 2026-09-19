import React from 'react';
import { Crown, Shield } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useVoiceStore } from '../stores/useVoiceStore';

export const MemberList: React.FC = () => {
  const { members, activeGroupId } = useChatStore();
  const { identity } = useAuthStore();
  const { channelParticipants, isSpeaking } = useVoiceStore();

  if (!activeGroupId) return null;

  const onlineMembers = members.filter((m) => m.status === 'online');
  const offlineMembers = members.filter((m) => m.status !== 'online');

  const renderMember = (member: (typeof members)[0]) => {
    const avatarColor = member.pubkey ? '#' + member.pubkey.substring(0, 6) : '#6366f1';
    const isLocal = member.userId === identity?.userId;
    const isSpeakingMember = isLocal
      ? isSpeaking
      : Object.values(channelParticipants).some((list) =>
          list.some((p) => p.userId === member.userId && p.speaking),
        );

    return (
      <div
        key={member.userId}
        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-slate-800/40"
      >
        <div className="relative">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white shadow transition-all duration-150 ${
              isSpeakingMember
                ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-950 shadow-sm shadow-emerald-400/80 scale-105'
                : ''
            }`}
            style={{ backgroundColor: avatarColor }}
          >
            {member.displayName.charAt(0).toUpperCase()}
          </div>
          <span
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900 ${
              member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span
              className={`truncate text-xs font-medium ${
                isSpeakingMember
                  ? 'text-emerald-300 font-semibold'
                  : member.status === 'online'
                  ? 'text-slate-200'
                  : 'text-slate-500'
              }`}
            >
              {member.displayName}
            </span>
            {member.role === 'owner' && (
              <span title="Sunucu Sahibi">
                <Crown className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              </span>
            )}
            {member.role === 'admin' && (
              <span title="Yönetici">
                <Shield className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-56 flex-col bg-slate-950/70 border-l border-slate-800/60 p-3 select-none overflow-y-auto">
      {onlineMembers.length > 0 && (
        <div className="mb-4">
          <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Çevrimiçi — {onlineMembers.length}
          </div>
          <div className="space-y-0.5">{onlineMembers.map(renderMember)}</div>
        </div>
      )}

      {offlineMembers.length > 0 && (
        <div>
          <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Çevrimdışı — {offlineMembers.length}
          </div>
          <div className="space-y-0.5">{offlineMembers.map(renderMember)}</div>
        </div>
      )}
    </div>
  );
};
