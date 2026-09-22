import React from 'react';
import { MessageSquare, Users, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useDmStore } from '../stores/useDmStore';
import { DmChatArea } from './DmChatArea';

export const DirectMessagesView: React.FC = () => {
  const { identity } = useAuthStore();
  const { groups } = useChatStore();
  const { activePeer, threads, setActivePeer } = useDmStore();

  if (activePeer) {
    return <DmChatArea peer={activePeer} />;
  }

  return (
    <div className="flex flex-1 flex-col h-full bg-slate-900 select-none">
      {/* Top Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-5 w-5 text-indigo-400" />
          <span className="font-bold text-white text-sm">Direkt Mesajlar &amp; Ana Sayfa</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Uçtan Uca Doğrulanmış Kimlik</span>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center">
        <div className="w-full max-w-md space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-xl shadow-indigo-500/10">
            <MessageSquare className="h-10 w-10" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">Hoş Geldin, {identity?.displayName}!</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Burası senin direkt mesajlar merkezin. Sol menüdeki listeden bir arkadaşını seçerek
              özel mesajlaşabilir ya da üyesi olduğun grupların üye listesinden birine mesaj
              atabilirsin.
            </p>
          </div>

          {/* Quick Stats / Info Cards */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-semibold">Aktif Grupların</span>
              </div>
              <div className="text-lg font-bold text-white">{groups.length} Grup</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Soldaki listeden erişilebilir</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold">Özel DM Sohbetleri</span>
              </div>
              <div className="text-lg font-bold text-white">{threads.length} Sohbet</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Sol panelden birine tıkla</div>
            </div>
          </div>

          {/* Recent DM Threads Quick Links if available */}
          {threads.length > 0 && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-left">
              <div className="text-xs font-semibold text-slate-400 mb-2">Son Görüşülenler</div>
              <div className="space-y-1.5">
                {threads.slice(0, 5).map((t) => (
                  <button
                    key={t.peerId}
                    onClick={() => {
                      useChatStore.getState().setActiveGroup(null);
                      setActivePeer({
                        peerId: t.peerId,
                        peerName: t.peerName,
                        peerColor: t.peerColor,
                      });
                    }}
                    className="w-full flex items-center justify-between rounded-lg p-2 hover:bg-slate-800/60 transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: t.peerColor || '#6366f1' }}
                      >
                        {t.peerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-white">{t.peerName}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                          {t.lastMessagePreview || 'Mesaj yok'}
                        </div>
                      </div>
                    </div>
                    {t.unreadCount > 0 && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {t.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
