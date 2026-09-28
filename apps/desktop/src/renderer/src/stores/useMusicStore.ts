import { create } from 'zustand';
import type { MusicPlaybackState } from '@echo/shared';

const SAVED_VOLUME = Number(localStorage.getItem('echo_music_volume') ?? '75');

interface MusicStoreState {
  playbackStates: Record<string, MusicPlaybackState>;
  volume: number; // 0 - 100
  isMuted: boolean;
  isPanelOpen: boolean;
  isExpandedStage: boolean;

  setPlaybackState: (state: MusicPlaybackState) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPanelOpen: (open: boolean) => void;
  setExpandedStage: (expanded: boolean) => void;
  getChannelPlayback: (channelId: string | null) => MusicPlaybackState | null;
}

export const useMusicStore = create<MusicStoreState>((set, get) => ({
  playbackStates: {},
  volume: isNaN(SAVED_VOLUME) ? 75 : Math.max(0, Math.min(100, SAVED_VOLUME)),
  isMuted: false,
  isPanelOpen: false,
  isExpandedStage: false,

  setPlaybackState: (state) =>
    set((prev) => ({
      playbackStates: {
        ...prev.playbackStates,
        [state.channelId]: state,
      },
    })),

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(100, volume));
    localStorage.setItem('echo_music_volume', String(clamped));
    set({ volume: clamped });
  },

  toggleMute: () => set((prev) => ({ isMuted: !prev.isMuted })),

  setPanelOpen: (isPanelOpen) => set({ isPanelOpen }),

  setExpandedStage: (isExpandedStage) => set({ isExpandedStage }),

  getChannelPlayback: (channelId) => {
    if (!channelId) return null;
    return get().playbackStates[channelId] ?? null;
  },
}));
