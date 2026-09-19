import { create } from 'zustand';
import type { VoiceParticipant, PeerDiagnosticsStats } from '@echo/shared';

export type VoiceInputMode = 'vad' | 'ptt';

export interface VoiceState {
  currentGroupId: string | null;
  currentGroupName: string | null;
  currentChannelId: string | null;
  currentChannelName: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  pingMs: number;

  // Push-to-Talk configuration
  inputMode: VoiceInputMode;
  pttKey: string;
  pttKeyDisplay: string;
  pttReleaseDelay: number;
  isPttActive: boolean;

  // channelId -> VoiceParticipant[]
  channelParticipants: Record<string, VoiceParticipant[]>;

  // peerId -> PeerDiagnosticsStats
  diagnostics: Record<string, PeerDiagnosticsStats>;
  isDiagnosticsOpen: boolean;

  // Actions
  setConnecting: (
    groupId: string,
    groupName: string,
    channelId: string,
    channelName: string,
  ) => void;
  setConnected: (channelId: string) => void;
  setDisconnected: () => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setPingMs: (ping: number) => void;

  setInputMode: (mode: VoiceInputMode) => void;
  setPttKey: (key: string, display: string) => void;
  setPttReleaseDelay: (delay: number) => void;
  setPttActive: (active: boolean) => void;

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

const getInitialInputMode = (): VoiceInputMode => {
  try {
    const val = localStorage.getItem('echo_voice_input_mode');
    return val === 'ptt' ? 'ptt' : 'vad';
  } catch {
    return 'vad';
  }
};

const getInitialPttKey = (): string => {
  try {
    return localStorage.getItem('echo_voice_ptt_key') || 'KeyV';
  } catch {
    return 'KeyV';
  }
};

const getInitialPttKeyDisplay = (): string => {
  try {
    return localStorage.getItem('echo_voice_ptt_display') || 'V';
  } catch {
    return 'V';
  }
};

const getInitialPttReleaseDelay = (): number => {
  try {
    const val = localStorage.getItem('echo_voice_ptt_delay');
    return val ? Number(val) : 200;
  } catch {
    return 200;
  }
};

export const useVoiceStore = create<VoiceState>((set) => ({
  currentGroupId: null,
  currentGroupName: null,
  currentChannelId: null,
  currentChannelName: null,
  connectionStatus: 'disconnected',
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  pingMs: 0,

  inputMode: getInitialInputMode(),
  pttKey: getInitialPttKey(),
  pttKeyDisplay: getInitialPttKeyDisplay(),
  pttReleaseDelay: getInitialPttReleaseDelay(),
  isPttActive: false,

  channelParticipants: {},
  diagnostics: {},
  isDiagnosticsOpen: false,

  setConnecting: (groupId, groupName, channelId, channelName) =>
    set({
      currentGroupId: groupId,
      currentGroupName: groupName,
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
      currentGroupId: null,
      currentGroupName: null,
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

  setInputMode: (inputMode) => {
    try {
      localStorage.setItem('echo_voice_input_mode', inputMode);
    } catch {
      // Ignore
    }
    set({ inputMode });
  },

  setPttKey: (pttKey, pttKeyDisplay) => {
    try {
      localStorage.setItem('echo_voice_ptt_key', pttKey);
      localStorage.setItem('echo_voice_ptt_display', pttKeyDisplay);
    } catch {
      // Ignore
    }
    set({ pttKey, pttKeyDisplay });
  },

  setPttReleaseDelay: (pttReleaseDelay) => {
    try {
      localStorage.setItem('echo_voice_ptt_delay', String(pttReleaseDelay));
    } catch {
      // Ignore
    }
    set({ pttReleaseDelay });
  },

  setPttActive: (isPttActive) => set({ isPttActive }),

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
