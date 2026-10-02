import { create } from 'zustand';

interface E2EEStore {
  isE2EEEnabled: boolean;
  toggleE2EE: () => void;
  setE2EEEnabled: (enabled: boolean) => void;
}

export const useE2EEStore = create<E2EEStore>((set) => ({
  isE2EEEnabled: true, // Enabled by default for maximum privacy & security

  toggleE2EE: () => set((state) => ({ isE2EEEnabled: !state.isE2EEEnabled })),
  setE2EEEnabled: (isE2EEEnabled) => set({ isE2EEEnabled }),
}));
