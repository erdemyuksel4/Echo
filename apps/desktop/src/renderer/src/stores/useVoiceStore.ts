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

export const useVoiceStore = create<VoiceState>((set) => ({
  currentGroupId: null,
  currentGroupName: null,
  currentChannelId: null,
  currentChannelName: null,
  connectionStatus: 'disconnected',
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
      isSpeaking: false,
      isCameraActive: false,
      cameraStreams: {},
      pingMs: 0,
      diagnostics: {},
      localAudioLevel: 0,
      isMicUnavailable: false,
    }),

  setMuted: (isMuted) => set({ isMuted }),
  setDeafened: (isDeafened) => set({ isDeafened, isMuted: isDeafened ? true : undefined }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
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
          [channelId]: list.map((p) =>
            p.userId === userId
              ? {
                  ...p,
                  muted: update.muted,
                  deafened: update.deafened,
                  speaking: update.speaking,
                  camera: update.camera !== undefined ? update.camera : p.camera,
                }
              : p,
          ),
        },
      };
    }),

  setDiagnostics: (diagnostics) => set({ diagnostics }),
  setDiagnosticsOpen: (isDiagnosticsOpen) => set({ isDiagnosticsOpen }),
}));
