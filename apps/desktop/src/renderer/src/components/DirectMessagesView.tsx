import React from 'react';
import { MessageSquare, Users, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';

export const DirectMessagesView: React.FC = () => {
  const { identity } = useAuthStore();
  const { groups } = useChatStore();

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
            <h2 className="text-xl font-bold text-white">
              Hoş Geldin, {identity?.displayName}!
            </h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Burası senin ana merkezin. Sol menüden bir grup seçerek sohbet kanallarına katılabilir veya arkadaşlarınla birebir özel görüşmeler yapabilirsin.
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
                <span className="text-xs font-semibold">Özel DM Modu</span>
              </div>
              <div className="text-xs font-medium text-slate-300 mt-1">Faz 5 ile Hazır</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Ortak grup arkadaşlarıyla birebir</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
