import type { UserProfile } from '@echo/shared';
export type StoredIdentityProfile = UserProfile & {
    publicKeyHex: string;
};
interface AuthState {
    identity: StoredIdentityProfile | null;
    isLoaded: boolean;
    loadIdentity: () => Promise<void>;
    createIdentity: (displayName: string, avatarColor: string) => Promise<void>;
}
export declare const useAuthStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AuthState>>;
export {};
