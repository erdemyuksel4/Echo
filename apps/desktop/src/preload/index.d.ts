import type { UserProfile, ScreenShareSource } from '@echo/shared';
export interface AppInfo {
    appName: string;
    protocolVersion: number;
    appVersion: string;
    platform: string;
    electronVersion?: string;
    chromeVersion?: string;
    nodeVersion?: string;
    arch?: string;
}
export interface StoredIdentityProfile extends UserProfile {
    publicKeyHex: string;
}
export interface SignedAuthResult {
    sig: string;
    pubkey: string;
    userId: string;
}
export interface EchoApi {
    getAppInfo: () => Promise<AppInfo>;
    getIdentity: () => Promise<StoredIdentityProfile | null>;
    createIdentity: (displayName: string, avatarColor: string) => Promise<StoredIdentityProfile>;
    signAuth: (targetId: string, timestamp: number) => Promise<SignedAuthResult | null>;
    signPayload: (payload: string) => Promise<SignedAuthResult | null>;
    showNotification: (options: {
        title: string;
        body: string;
        silent?: boolean;
    }) => Promise<boolean>;
    setBadgeCount: (count: number) => Promise<boolean>;
    copyToClipboard: (text: string) => Promise<boolean>;
    openExternal: (url: string) => Promise<boolean>;
    getDesktopSources: () => Promise<ScreenShareSource[]>;
    getLoginItemSettings: () => Promise<{
        openAtLogin: boolean;
    }>;
    setLoginItemSettings: (openAtLogin: boolean) => Promise<boolean>;
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    quitAndInstall: () => void;
    onUpdateStatus: (cb: (data: {
        status: string;
        version?: string;
        error?: string;
    }) => void) => () => void;
    onUpdateAvailable: (cb: (info: {
        version: string;
        releaseNotes?: string;
    }) => void) => () => void;
    onUpdateProgress: (cb: (progress: {
        percent: number;
        bytesPerSecond: number;
    }) => void) => () => void;
    onUpdateDownloaded: (cb: (info: {
        version: string;
    }) => void) => () => void;
}
