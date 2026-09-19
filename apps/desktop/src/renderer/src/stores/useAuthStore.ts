import { create } from 'zustand';
import type { UserProfile } from '@echo/shared';

export type StoredIdentityProfile = UserProfile & { publicKeyHex: string };

interface AuthState {
  identity: StoredIdentityProfile | null;
  isLoaded: boolean;
  loadIdentity: () => Promise<void>;
  createIdentity: (displayName: string, avatarColor: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  identity: null,
  isLoaded: false,

  loadIdentity: async () => {
    try {
      if (window.echoApi?.getIdentity) {
        const id = await window.echoApi.getIdentity();
        set({ identity: id, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (err) {
      console.error('Failed to load identity:', err);
      set({ isLoaded: true });
    }
  },

  createIdentity: async (displayName: string, avatarColor: string) => {
    if (!window.echoApi?.createIdentity) throw new Error('echoApi unavailable');
    const newId = await window.echoApi.createIdentity(displayName, avatarColor);
    set({ identity: newId });
  },
}));
