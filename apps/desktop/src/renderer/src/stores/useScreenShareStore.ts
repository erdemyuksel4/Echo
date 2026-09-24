import { create } from 'zustand';
import type { ScreenShareState, ScreenQualityPreset } from '@echo/shared';
import { screenShareTransport } from '../services/screenShare/transport';
import { wsService } from '../services/websocket';

export interface ViewingShareState {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  isLoading: boolean;
}

interface ScreenShareStoreState {
  isSharing: boolean;
  localStream: MediaStream | null;
  activeShares: ScreenShareState[];
  viewingShare: ViewingShareState | null;
  viewerCount: number;
  isModalViewerOpen: boolean;

  setIsSharing: (sharing: boolean, stream?: MediaStream | null) => void;
  setActiveShares: (shares: ScreenShareState[]) => void;
  addOrUpdateShare: (share: ScreenShareState) => void;
  removeShare: (userId: string) => void;
  setViewingShare: (viewing: ViewingShareState | null) => void;
  setViewerCount: (count: number) => void;
  openModalViewer: () => void;
  closeModalViewer: () => void;

  startSharing: (
    channelId: string,
    stream: MediaStream,
    quality: ScreenQualityPreset,
    mode: 'motion' | 'detail',
    hasAudio: boolean,
  ) => Promise<void>;
  stopSharing: (channelId: string) => Promise<void>;
  watchStream: (targetUserId: string, displayName: string, channelId: string) => Promise<void>;
  stopWatching: () => void;
}

export const useScreenShareStore = create<ScreenShareStoreState>((set, get) => ({
  isSharing: false,
  localStream: null,
  activeShares: [],
  viewingShare: null,
  viewerCount: 0,
  isModalViewerOpen: false,

  setIsSharing: (isSharing, localStream = null) => set({ isSharing, localStream }),
  setActiveShares: (activeShares) => set({ activeShares }),
  openModalViewer: () => set({ isModalViewerOpen: true }),
  closeModalViewer: () => set({ isModalViewerOpen: false }),

  addOrUpdateShare: (share) =>
    set((state) => {
      const idx = state.activeShares.findIndex((s) => s.userId === share.userId);
      if (idx !== -1) {
        const updated = [...state.activeShares];
        updated[idx] = share;
        return { activeShares: updated };
      }
      return { activeShares: [...state.activeShares, share] };
    }),

  removeShare: (userId) =>
    set((state) => {
      const updated = state.activeShares.filter((s) => s.userId !== userId);
      const isViewingThis = state.viewingShare?.userId === userId;
      if (isViewingThis) {
        screenShareTransport.stopWatching(userId);
      }
      return {
        activeShares: updated,
        viewingShare: isViewingThis ? null : state.viewingShare,
      };
    }),

  setViewingShare: (viewingShare) => set({ viewingShare }),
  setViewerCount: (viewerCount) => set({ viewerCount }),

  startSharing: async (channelId, stream, quality, mode, hasAudio) => {
    await screenShareTransport.startSharing(stream, channelId, quality);
    set({ isSharing: true, localStream: stream, viewerCount: 0 });

    wsService.sendShareStart(channelId, quality, mode, hasAudio);
  },

  stopSharing: async (channelId) => {
    await screenShareTransport.stopSharing();
    set({ isSharing: false, localStream: null, viewerCount: 0 });

    wsService.sendShareStop(channelId);
  },

  watchStream: async (targetUserId, displayName, channelId) => {
    set({
      viewingShare: {
        userId: targetUserId,
        displayName,
        stream: null,
        isLoading: true,
      },
    });

    try {
      const stream = await screenShareTransport.watchStream(targetUserId, channelId);
      set({
        viewingShare: {
          userId: targetUserId,
          displayName,
          stream,
          isLoading: false,
        },
      });
    } catch (err) {
      console.error('Failed to watch screen share stream:', err);
      set({ viewingShare: null });
    }
  },

  stopWatching: () => {
    const current = get().viewingShare;
    if (current) {
      screenShareTransport.stopWatching(current.userId);
    }
    set({ viewingShare: null, isModalViewerOpen: false });
  },
}));
