import { create } from 'zustand';
export const useAuthStore = create((set) => ({
    identity: null,
    isLoaded: false,
    loadIdentity: async () => {
        try {
            if (window.echoApi?.getIdentity) {
                const id = await window.echoApi.getIdentity();
                set({ identity: id, isLoaded: true });
            }
            else {
                set({ isLoaded: true });
            }
        }
        catch (err) {
            console.error('Failed to load identity:', err);
            set({ isLoaded: true });
        }
    },
    createIdentity: async (displayName, avatarColor) => {
        if (!window.echoApi?.createIdentity)
            throw new Error('echoApi unavailable');
        const newId = await window.echoApi.createIdentity(displayName, avatarColor);
        set({ identity: newId });
    },
}));
