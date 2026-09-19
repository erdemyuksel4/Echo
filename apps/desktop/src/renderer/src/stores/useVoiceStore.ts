import { create } from 'zustand';
import type { VoiceParticipant, PeerDiagnosticsStats } from '@echo/shared';

export interface VoiceState {
  currentChannelId: string | null;
  currentChannelName: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  pingMs: number;

  // channelId -> VoiceParticipant[]
  channelParticipants: Record<string, VoiceParticipant[]>;

  // peerId -> PeerDiagnosticsStats
  diagnostics: Record<string, PeerDiagnosticsStats>;
  isDiagnosticsOpen: boolean;

  // Actions
  setConnecting: (channelId: string, channelName: string) => void;
  setConnected: (channelId: string) => void;
  setDisconnected: () => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setPingMs: (ping: number) => void;

  setChannelParticipants: (channelId: string, participants: VoiceParticipant[]) => void;
  addChannelParticipant: (channelId: string, participant: VoiceParticipant) => void;
  removeChannelParticipant: (channelId: string, userId: string) => void;
  updateChannelParticipantState: (
    channelId: string,
    userId: string,
    state: { muted: boolean; deafened: boolean; speaking: boolean },
  ) => void;

  setDiagnostics: (diagnostics: Record<string, PeerDiagnosticsStats>) => void;
  setDiagnosticsOpen: (open: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  currentChannelId: null,
  currentChannelName: null,
  connectionStatus: 'disconnected',
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  pingMs: 0,
  channelParticipants: {},
  diagnostics: {},
  isDiagnosticsOpen: false,

  setConnecting: (channelId, channelName) =>
    set({
      currentChannelId: channelId,
      currentChannelName: channelName,
      connectionStatus: 'connecting',
    }),

  setConnected: (channelId) =>
    set((state) => ({
      currentChannelId: channelId,
      connectionStatus: 'connected',
      channelParticipants: state.channelParticipants,
    })),

  setDisconnected: () =>
    set({
      currentChannelId: null,
      currentChannelName: null,
      connectionStatus: 'disconnected',
      isSpeaking: false,
      pingMs: 0,
      diagnostics: {},
    }),

  setMuted: (isMuted) => set({ isMuted }),
  setDeafened: (isDeafened) => set({ isDeafened, isMuted: isDeafened ? true : undefined }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setPingMs: (pingMs) => set({ pingMs }),

  setChannelParticipants: (channelId, participants) =>
    set((state) => ({
      channelParticipants: {
        ...state.channelParticipants,
        [channelId]: participants,
      },
    })),

  addChannelParticipant: (channelId, participant) =>
    set((state) => {
      const list = state.channelParticipants[channelId] ?? [];
      if (list.some((p) => p.userId === participant.userId)) {
        return state;
      }
      return {
        channelParticipants: {
          ...state.channelParticipants,
          [channelId]: [...list, participant],
        },
      };
    }),

  removeChannelParticipant: (channelId, userId) =>
    set((state) => {
      const list = state.channelParticipants[channelId] ?? [];
      return {
        channelParticipants: {
          ...state.channelParticipants,
          [channelId]: list.filter((p) => p.userId !== userId),
        },
      };
    }),

  updateChannelParticipantState: (channelId, userId, update) =>
    set((state) => {
      const list = state.channelParticipants[channelId] ?? [];
      return {
        channelParticipants: {
          ...state.channelParticipants,
          [channelId]: list.map((p) =>
            p.userId === userId
              ? {
                  ...p,
                  muted: update.muted,
                  deafened: update.deafened,
                  speaking: update.speaking,
                }
              : p,
          ),
        },
      };
    }),

  setDiagnostics: (diagnostics) => set({ diagnostics }),
  setDiagnosticsOpen: (isDiagnosticsOpen) => set({ isDiagnosticsOpen }),
}));
