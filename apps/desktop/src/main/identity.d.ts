import { type UserProfile } from '@echo/shared';
export declare class IdentityManager {
    private identityPath;
    constructor();
    getIdentity(): (UserProfile & {
        publicKeyHex: string;
    }) | null;
    createIdentity(displayName: string, avatarColor: string): UserProfile & {
        publicKeyHex: string;
    };
    private getPrivateKeyHex;
    signAuth(targetId: string, timestamp: number): {
        sig: string;
        pubkey: string;
        userId: string;
    } | null;
    signPayload(payload: string): {
        sig: string;
        pubkey: string;
        userId: string;
    } | null;
}
