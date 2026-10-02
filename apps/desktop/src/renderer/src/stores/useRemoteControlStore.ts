import { create } from 'zustand';

interface VirtualCursorState {
  x: number; // 0.0 - 1.0
  y: number; // 0.0 - 1.0
  displayName: string;
  isDown: boolean;
}

interface PendingRemoteRequest {
  channelId: string;
  requesterUserId: string;
  requesterDisplayName: string;
}

interface RemoteControlStore {
  // Controller state (Viewer who requested control)
  isControlling: boolean;
  controllingStreamUserId: string | null;
  controllingChannelId: string | null;

  // Controlled state (Streamer whose screen is being controlled)
  isControlled: boolean;
  controlledByUserId: string | null;
  controlledByDisplayName: string | null;

  // Incoming permission request (Streamer side)
  pendingRequest: PendingRemoteRequest | null;

  // Live remote cursor point on Streamer's screen
  virtualCursor: VirtualCursorState | null;

  // Actions
  setPendingRequest: (req: PendingRemoteRequest | null) => void;
  startControlling: (channelId: string, streamUserId: string) => void;
  startControlled: (userId: string, displayName: string) => void;
  updateVirtualCursor: (cursor: VirtualCursorState | null) => void;
  reset: () => void;
}

export const useRemoteControlStore = create<RemoteControlStore>((set) => ({
  isControlling: false,
  controllingStreamUserId: null,
  controllingChannelId: null,

  isControlled: false,
  controlledByUserId: null,
  controlledByDisplayName: null,

  pendingRequest: null,
  virtualCursor: null,

  setPendingRequest: (pendingRequest) => set({ pendingRequest }),

  startControlling: (controllingChannelId, controllingStreamUserId) =>
    set({
      isControlling: true,
      controllingChannelId,
      controllingStreamUserId,
    }),

  startControlled: (controlledByUserId, controlledByDisplayName) =>
    set({
      isControlled: true,
      controlledByUserId,
      controlledByDisplayName,
      pendingRequest: null,
    }),

  updateVirtualCursor: (virtualCursor) => set({ virtualCursor }),

  reset: () =>
    set({
      isControlling: false,
      controllingStreamUserId: null,
      controllingChannelId: null,
      isControlled: false,
      controlledByUserId: null,
      controlledByDisplayName: null,
      pendingRequest: null,
      virtualCursor: null,
    }),
}));
