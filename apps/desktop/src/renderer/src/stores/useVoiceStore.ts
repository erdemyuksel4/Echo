import { create } from 'zustand';
import {
  type VoiceParticipant,
  type PeerDiagnosticsStats,
  UserAudioState,
  VoiceConnectionState,
} from '@echo/shared';

export type VoiceInputMode = 'vad' | 'ptt';

export interface VoiceState {
  currentGroupId: string | null;
  currentGroupName: string | null;
  currentChannelId: string | null;
  currentChannelName: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | VoiceConnectionState;
  audioState: UserAudioState;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isCameraActive: boolean;
  cameraStreams: Record<string, MediaStream>;
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

  localAudioLevel: number;
  isMicUnavailable: boolean;
  isSelfLoopbackActive: boolean;

  // Actions
  setSelfLoopbackActive: (active: boolean) => void;
  toggleSelfLoopback: () => void;
  setConnecting: (
    groupId: string,
    groupName: string,
    channelId: string,
    channelName: string,
  ) => void;
  setConnected: (channelId: string) => void;
  setDisconnected: () => void;
  setAudioState: (state: UserAudioState, myUserId?: string) => void;
  setMuted: (muted: boolean, myUserId?: string) => void;
  setDeafened: (deafened: boolean, myUserId?: string) => void;
  setSpeaking: (speaking: boolean, myUserId?: string) => void;
  setCameraActive: (active: boolean) => void;
  setPeerCameraStream: (peerId: string, stream: MediaStream) => void;
  removePeerCameraStream: (peerId: string) => void;
  setPingMs: (ping: number) => void;
  setLocalAudioLevel: (level: number) => void;
  setIsMicUnavailable: (unavailable: boolean) => void;

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
    state: { muted: boolean; deafened: boolean; speaking: boolean; camera?: boolean },
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

const getInitialSelfLoopback = (): boolean => {
  try {
    return localStorage.getItem('echo_voice_self_loopback') === 'true';
  } catch {
    return false;
  }
};

export const useVoiceStore = create<VoiceState>((set, get) => ({
  currentGroupId: null,
  currentGroupName: null,
  currentChannelId: null,
  currentChannelName: null,
  connectionStatus: 'disconnected',
  audioState: UserAudioState.IDLE,
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  isCameraActive: false,
  cameraStreams: {},
  pingMs: 0,

  inputMode: getInitialInputMode(),
  pttKey: getInitialPttKey(),
  pttKeyDisplay: getInitialPttKeyDisplay(),
  pttReleaseDelay: getInitialPttReleaseDelay(),
  isPttActive: false,

  channelParticipants: {},
  diagnostics: {},
  isDiagnosticsOpen: false,

  localAudioLevel: 0,
  isMicUnavailable: false,
  isSelfLoopbackActive: getInitialSelfLoopback(),

  setSelfLoopbackActive: (active: boolean) => {
    try {
      localStorage.setItem('echo_voice_self_loopback', String(active));
    } catch {
      // Ignore
    }
    set({ isSelfLoopbackActive: active });
  },

  toggleSelfLoopback: () => {
    const next = !get().isSelfLoopbackActive;
    try {
      localStorage.setItem('echo_voice_self_loopback', String(next));
    } catch {
      // Ignore
    }
    set({ isSelfLoopbackActive: next });
  },

  setConnecting: (groupId, groupName, channelId, channelName) =>
    set({
      currentGroupId: groupId,
      currentGroupName: groupName,
      currentChannelId: channelId,
      currentChannelName: channelName,
      connectionStatus: 'connecting',
      localAudioLevel: 0,
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
      audioState: UserAudioState.IDLE,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      isCameraActive: false,
      cameraStreams: {},
      pingMs: 0,
      diagnostics: {},
      localAudioLevel: 0,
      isMicUnavailable: false,
    }),

  setAudioState: (nextAudioState, myUserId) =>
    set((state) => {
      let isMuted = false;
      let isDeafened = false;
      let isSpeaking = false;

      switch (nextAudioState) {
        case UserAudioState.DEAFENED:
          isDeafened = true;
          isMuted = true;
          isSpeaking = false;
          break;
        case UserAudioState.MUTED:
          isDeafened = false;
          isMuted = true;
          isSpeaking = false;
          break;
        case UserAudioState.SPEAKING:
          isDeafened = false;
          isMuted = false;
          isSpeaking = true;
          break;
        case UserAudioState.IDLE:
        default:
          isDeafened = false;
          isMuted = false;
          isSpeaking = false;
          break;
      }

      let updatedParticipants = state.channelParticipants;
      if (state.currentChannelId && myUserId) {
        const list = state.channelParticipants[state.currentChannelId];
        if (list) {
          updatedParticipants = {
            ...state.channelParticipants,
            [state.currentChannelId]: list.map((p) =>
              p.userId === myUserId
                ? { ...p, muted: isMuted, deafened: isDeafened, speaking: isSpeaking }
                : p,
            ),
          };
        }
      }

      return {
        audioState: nextAudioState,
        isMuted,
        isDeafened,
        isSpeaking,
        channelParticipants: updatedParticipants,
      };
    }),

  setMuted: (isMuted, myUserId) => {
    const nextState = isMuted ? UserAudioState.MUTED : UserAudioState.IDLE;
    get().setAudioState(nextState, myUserId);
  },

  setDeafened: (isDeafened, myUserId) => {
    const nextState = isDeafened ? UserAudioState.DEAFENED : UserAudioState.IDLE;
    get().setAudioState(nextState, myUserId);
  },

  setSpeaking: (isSpeaking, myUserId) => {
    const current = get().audioState;
    // Conflict prevention: cannot transition to speaking if muted or deafened
    if (isSpeaking && (current === UserAudioState.MUTED || current === UserAudioState.DEAFENED || get().isMuted || get().isDeafened)) {
      return;
    }
    const nextState = isSpeaking ? UserAudioState.SPEAKING : UserAudioState.IDLE;
    get().setAudioState(nextState, myUserId);
  },

  setCameraActive: (isCameraActive) => set({ isCameraActive }),
  setPeerCameraStream: (peerId, stream) =>
    set((state) => ({
      cameraStreams: {
        ...state.cameraStreams,
        [peerId]: stream,
      },
    })),
  removePeerCameraStream: (peerId) =>
    set((state) => {
      const next = { ...state.cameraStreams };
      delete next[peerId];
      return { cameraStreams: next };
    }),
  setPingMs: (pingMs) => set({ pingMs }),
  setLocalAudioLevel: (localAudioLevel) => set({ localAudioLevel }),
  setIsMicUnavailable: (isMicUnavailable) => set({ isMicUnavailable }),

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
          [channelId]: list.map((p) => {
            if (p.userId !== userId) return p;
            const deafened = Boolean(update.deafened);
            const muted = deafened || Boolean(update.muted);
            const speaking = !muted && !deafened && Boolean(update.speaking);
            return {
              ...p,
              muted,
              deafened,
              speaking,
              camera: update.camera !== undefined ? update.camera : p.camera,
            };
          }),
        },
      };
    }),

  setDiagnostics: (diagnostics) => set({ diagnostics }),
  setDiagnosticsOpen: (isDiagnosticsOpen) => set({ isDiagnosticsOpen }),
}));
