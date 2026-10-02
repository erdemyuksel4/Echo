import { create } from 'zustand';

interface RecordingStore {
  isRecording: boolean;
  isSaving: boolean;
  recordingTargetName: string | null;
  durationSeconds: number;
  setRecording: (isRecording: boolean, targetName?: string) => void;
  setIsSaving: (isSaving: boolean) => void;
  setDuration: (duration: number) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  isRecording: false,
  isSaving: false,
  recordingTargetName: null,
  durationSeconds: 0,

  setRecording: (isRecording, targetName) =>
    set({
      isRecording,
      recordingTargetName: targetName || null,
      durationSeconds: 0,
      isSaving: false,
    }),

  setIsSaving: (isSaving) => set({ isSaving }),

  setDuration: (durationSeconds) => set({ durationSeconds }),

  reset: () =>
    set({
      isRecording: false,
      isSaving: false,
      recordingTargetName: null,
      durationSeconds: 0,
    }),
}));

export function formatRecordingDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
