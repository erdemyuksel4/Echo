import React, { useRef, useEffect } from 'react';
import { MousePointer2, X, ShieldAlert } from 'lucide-react';
import { useRemoteControlStore } from '../stores/useRemoteControlStore';
import { wsService } from '../services/websocket';

interface Props {
  channelId: string;
  streamUserId: string;
  isLocal: boolean;
}

export const RemoteControlOverlay: React.FC<Props> = ({
  channelId,
  streamUserId,
  isLocal,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    isControlling,
    controllingStreamUserId,
    isControlled,
    controlledByDisplayName,
    controlledByUserId,
    virtualCursor,
    reset,
  } = useRemoteControlStore();

  const isCurrentController = isControlling && controllingStreamUserId === streamUserId;

  // Handle Controller mouse/keyboard events to send to streamer
  useEffect(() => {
    if (!isCurrentController) return;

    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      wsService.sendRemoteControlEvent(channelId, streamUserId, {
        type: 'mousemove',
        x,
        y,
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      wsService.sendRemoteControlEvent(channelId, streamUserId, {
        type: 'mousedown',
        x,
        y,
        button: e.button,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      wsService.sendRemoteControlEvent(channelId, streamUserId, {
        type: 'mouseup',
        x,
        y,
        button: e.button,
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Exit remote control
        handleStopControl();
        return;
      }
      wsService.sendRemoteControlEvent(channelId, streamUserId, {
        type: 'keydown',
        key: e.key,
      });
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCurrentController, channelId, streamUserId]);

  const handleStopControl = () => {
    wsService.sendRemoteControlStop(channelId, streamUserId);
    reset();
  };

  const handleStreamerDisconnectControl = () => {
    if (controlledByUserId) {
      wsService.sendRemoteControlStop(channelId, controlledByUserId);
    }
    reset();
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-20 ${
        isCurrentController ? 'pointer-events-auto cursor-none' : 'pointer-events-none'
      }`}
    >
      {/* Streamer view: Live Virtual Laser Cursor of remote viewer */}
      {isLocal && isControlled && virtualCursor && (
        <div
          className="absolute z-30 pointer-events-none transition-transform duration-75 ease-out"
          style={{
            left: `${virtualCursor.x * 100}%`,
            top: `${virtualCursor.y * 100}%`,
            transform: 'translate(-4px, -4px)',
          }}
        >
          {/* Laser Cursor Point */}
          <div className="relative flex items-center">
            <MousePointer2 className="h-5 w-5 text-indigo-400 fill-indigo-500 drop-shadow-md" />
            <span className="ml-1.5 rounded bg-indigo-600/90 text-[10px] font-bold text-white px-1.5 py-0.5 shadow-md whitespace-nowrap">
              {virtualCursor.displayName}
            </span>
            {virtualCursor.isDown && (
              <span className="absolute -inset-1 rounded-full bg-indigo-400/40 animate-ping" />
            )}
          </div>
        </div>
      )}

      {/* Streamer Banner when screen is being remotely controlled */}
      {isLocal && isControlled && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl bg-rose-600/95 text-white px-3 py-1.5 text-xs font-bold shadow-xl border border-rose-400/50 pointer-events-auto select-none animate-pulse">
          <ShieldAlert className="h-4 w-4" />
          <span>Ekranınız {controlledByDisplayName} tarafından kontrol ediliyor</span>
          <button
            type="button"
            onClick={handleStreamerDisconnectControl}
            className="ml-2 rounded-lg bg-black/40 hover:bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white transition cursor-pointer"
          >
            Kontrolü Kes
          </button>
        </div>
      )}

      {/* Controller (Viewer) Banner when actively controlling */}
      {isCurrentController && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl bg-indigo-600/95 text-white px-3 py-1.5 text-xs font-bold shadow-xl border border-indigo-400/50 pointer-events-auto select-none">
          <MousePointer2 className="h-4 w-4 animate-bounce" />
          <span>Uzaktan Kontrol Ediyorsunuz (Çıkmak için ESC)</span>
          <button
            type="button"
            onClick={handleStopControl}
            className="ml-2 flex items-center gap-1 rounded-lg bg-black/40 hover:bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white transition cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>Bitir</span>
          </button>
        </div>
      )}
    </div>
  );
};
