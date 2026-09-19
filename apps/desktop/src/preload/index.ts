import { contextBridge, ipcRenderer } from 'electron';
import type { UserProfile } from '@echo/shared';

export interface AppInfo {
  appName: string;
  protocolVersion: number;
  appVersion: string;
  platform: string;
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
}

const echoApi: EchoApi = {
  getAppInfo: (): Promise<AppInfo> => {
    return ipcRenderer.invoke('app:get-info');
  },
  getIdentity: (): Promise<StoredIdentityProfile | null> => {
    return ipcRenderer.invoke('identity:get');
  },
  createIdentity: (displayName: string, avatarColor: string): Promise<StoredIdentityProfile> => {
    return ipcRenderer.invoke('identity:create', { displayName, avatarColor });
  },
  signAuth: (targetId: string, timestamp: number): Promise<SignedAuthResult | null> => {
    return ipcRenderer.invoke('identity:signAuth', { targetId, timestamp });
  },
  signPayload: (payload: string): Promise<SignedAuthResult | null> => {
    return ipcRenderer.invoke('identity:signPayload', { payload });
  },
};

try {
  contextBridge.exposeInMainWorld('echoApi', echoApi);
} catch (error) {
  console.error('[Echo Preload] Failed to expose echoApi via contextBridge:', error);
  // Fallback for non-isolated context
  const globalScope = globalThis as Record<string, unknown>;
  globalScope['echoApi'] = echoApi;
}
