import React from 'react';
import { ShieldAlert, Check, X, MousePointer2 } from 'lucide-react';
import { useRemoteControlStore } from '../stores/useRemoteControlStore';
import { wsService } from '../services/websocket';

export const RemoteControlPromptModal: React.FC = () => {
  const { pendingRequest, setPendingRequest, startControlled } = useRemoteControlStore();

  if (!pendingRequest) return null;

  const handleApprove = () => {
    wsService.sendRemoteControlResponse(
      pendingRequest.channelId,
      pendingRequest.requesterUserId,
      true,
    );
    startControlled(pendingRequest.requesterUserId, pendingRequest.requesterDisplayName);
  };

  const handleReject = () => {
    wsService.sendRemoteControlResponse(
      pendingRequest.channelId,
      pendingRequest.requesterUserId,
      false,
    );
    setPendingRequest(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <MousePointer2 className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Uzaktan Kontrol İsteği</h3>
            <p className="text-xs text-slate-400">TeamViewer tarzı ekran ve fare kontrolü</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/80 p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
          <p>
            <strong className="text-indigo-400 font-bold">{pendingRequest.requesterDisplayName}</strong>{' '}
            kullanıcısı bilgisayarınızı uzaktan kontrol etmek için izin talep ediyor.
          </p>
          <div className="flex items-start gap-1.5 text-amber-400/90 text-[11px] pt-1">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              İzin verdiğinizde karşı taraf ekranınızda imlecini hareket ettirebilir ve tıklama yapabilir. İstediğiniz an kontrolü iptal edebilirsiniz.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleReject}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer"
          >
            <X className="h-4 w-4 text-rose-400" />
            <span>Reddet</span>
          </button>
          <button
            type="button"
            onClick={handleApprove}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>İzin Ver</span>
          </button>
        </div>
      </div>
    </div>
  );
};
