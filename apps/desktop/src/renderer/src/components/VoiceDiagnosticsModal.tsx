import React from 'react';
import { X, Activity, Wifi, ShieldAlert, Radio, Volume2 } from 'lucide-react';
import { useVoiceStore } from '../stores/useVoiceStore';

export const VoiceDiagnosticsModal: React.FC = () => {
  const { isDiagnosticsOpen, setDiagnosticsOpen, diagnostics, currentChannelName, pingMs } =
    useVoiceStore();

  if (!isDiagnosticsOpen) return null;

  const peerList = Object.values(diagnostics);

  const getCandidateBadge = (type: string) => {
    switch (type) {
      case 'host':
        return (
          <span className="rounded bg-emerald-900/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-700/50">
            Host (Doğrudan LAN/P2P)
          </span>
        );
      case 'srflx':
        return (
          <span className="rounded bg-blue-900/60 px-2 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-700/50">
            STUN (NAT Delme - srflx)
          </span>
        );
      case 'relay':
        return (
          <span className="rounded bg-purple-900/60 px-2 py-0.5 text-[11px] font-semibold text-purple-400 border border-purple-700/50">
            TURN (Röle Sunucusu)
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-700">
            {type || 'Bilinmiyor'}
          </span>
        );
    }
  };

  const getRttColor = (rtt: number) => {
    if (rtt <= 50) return 'text-emerald-400';
    if (rtt <= 120) return 'text-yellow-400';
    return 'text-rose-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ses Bağlantı Tanı Paneli</h2>
              <p className="text-xs text-slate-400">
                Kanal: <span className="text-slate-200 font-medium">#{currentChannelName}</span>{' '}
                &bull; Ortalama Gecikme:{' '}
                <span className={`font-semibold ${getRttColor(pingMs)}`}>{pingMs} ms</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setDiagnosticsOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {peerList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Radio className="h-10 w-10 text-slate-600 mb-3 animate-pulse" />
              <p className="text-sm font-medium text-slate-300">
                Kanalda henüz başka bir katılımcı yok
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Başka bir kullanıcı bu ses kanalına katıldığında gerçek zamanlı WebRTC mesh
                istatistikleri burada listelenecektir.
              </p>
            </div>
          ) : (
            peerList.map((peer) => (
              <div
                key={peer.peerId}
                className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-4 transition hover:border-slate-700/80"
              >
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                    <span className="font-semibold text-white text-sm">{peer.displayName}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ({peer.peerId.slice(0, 10)}...)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono uppercase text-[10px] px-2 py-0.5 rounded bg-slate-800">
                      {peer.connectionState}
                    </span>
                    {getCandidateBadge(peer.candidateType)}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {/* RTT */}
                  <div className="bg-slate-900/90 rounded-md p-2.5 border border-slate-800/50">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                      <Wifi className="h-3.5 w-3.5 text-slate-400" />
                      <span>Gecikme (RTT)</span>
                    </div>
                    <div className={`text-base font-bold ${getRttColor(peer.rttMs)} font-mono`}>
                      {peer.rttMs} ms
                    </div>
                  </div>

                  {/* Packet Loss */}
                  <div className="bg-slate-900/90 rounded-md p-2.5 border border-slate-800/50">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
                      <span>Paket Kaybı</span>
                    </div>
                    <div className="text-base font-bold text-slate-200 font-mono">
                      {peer.packetsLost}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        ({Math.round((peer.fractionLost || 0) * 100)}%)
                      </span>
                    </div>
                  </div>

                  {/* Bitrate */}
                  <div className="bg-slate-900/90 rounded-md p-2.5 border border-slate-800/50">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                      <Radio className="h-3.5 w-3.5 text-slate-400" />
                      <span>Bit Hızı</span>
                    </div>
                    <div className="text-base font-bold text-slate-200 font-mono">
                      {peer.bitrateKbps}{' '}
                      <span className="text-xs font-normal text-slate-400">kbps</span>
                    </div>
                  </div>

                  {/* Audio Level */}
                  <div className="bg-slate-900/90 rounded-md p-2.5 border border-slate-800/50">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                      <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>Ses Seviyesi</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all duration-150"
                          style={{
                            width: `${Math.min(100, Math.round((peer.audioLevel || 0) * 100))}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-300">
                        {Math.round((peer.audioLevel || 0) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {(peer.localCandidateType || peer.remoteCandidateType) && (
                  <div className="mt-3 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Yerel Aday:{' '}
                      <code className="text-slate-300">{peer.localCandidateType || 'n/a'}</code>
                    </span>
                    <span>
                      Uzak Aday:{' '}
                      <code className="text-slate-300">{peer.remoteCandidateType || 'n/a'}</code>
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Her 1.5 saniyede bir getStats() ile güncelleniyor</span>
          </div>
          <button
            onClick={() => setDiagnosticsOpen(false)}
            className="rounded-md bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-1.5 transition"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
