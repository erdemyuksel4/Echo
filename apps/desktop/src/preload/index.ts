import { contextBridge, ipcRenderer } from 'electron';
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
  showNotification: (options: { title: string; body: string; silent?: boolean }) => Promise<boolean>;
  setBadgeCount: (count: number) => Promise<boolean>;
  copyToClipboard: (text: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  getDesktopSources: () => Promise<ScreenShareSource[]>;
  getLoginItemSettings: () => Promise<{ openAtLogin: boolean }>;
  setLoginItemSettings: (openAtLogin: boolean) => Promise<boolean>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  quitAndInstall: () => void;
  onUpdateStatus: (cb: (data: { status: string; version?: string; error?: string }) => void) => () => void;
  onUpdateAvailable: (cb: (info: { version: string; releaseNotes?: string }) => void) => () => void;
  onUpdateProgress: (cb: (progress: { percent: number; bytesPerSecond: number }) => void) => () => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void;
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
  showNotification: (options: { title: string; body: string; silent?: boolean }): Promise<boolean> => {
    return ipcRenderer.invoke('desktop:notify', options);
  },
  setBadgeCount: (count: number): Promise<boolean> => {
    return ipcRenderer.invoke('desktop:setBadge', { count });
  },
  copyToClipboard: (text: string): Promise<boolean> => {
    return ipcRenderer.invoke('desktop:copyToClipboard', { text });
  },
  openExternal: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke('desktop:openExternal', { url });
  },
  getDesktopSources: (): Promise<ScreenShareSource[]> => {
    return ipcRenderer.invoke('desktop:getSources');
  },
  getLoginItemSettings: (): Promise<{ openAtLogin: boolean }> => {
    return ipcRenderer.invoke('desktop:getLoginItemSettings');
  },
  setLoginItemSettings: (openAtLogin: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('desktop:setLoginItemSettings', { openAtLogin });
  },
  checkForUpdates: async (): Promise<void> => {
    await ipcRenderer.invoke('updater:check');
  },
  downloadUpdate: async (): Promise<void> => {
    await ipcRenderer.invoke('updater:download');
  },
  quitAndInstall: (): void => {
    void ipcRenderer.invoke('updater:install');
  },
  onUpdateStatus: (
    cb: (data: { status: string; version?: string; error?: string }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { status: string; version?: string; error?: string },
    ): void => {
      cb(data);
    };
    ipcRenderer.on('updater:status', handler);
    return () => {
      ipcRenderer.removeListener('updater:status', handler);
    };
  },
  onUpdateAvailable: (cb: (info: { version: string; releaseNotes?: string }) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { version: string; releaseNotes?: string },
    ): void => {
      cb(info);
    };
    ipcRenderer.on('updater:available', handler);
    return () => {
      ipcRenderer.removeListener('updater:available', handler);
    };
  },
  onUpdateProgress: (
    cb: (progress: { percent: number; bytesPerSecond: number }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { percent: number; bytesPerSecond: number },
    ): void => {
      cb(progress);
    };
    ipcRenderer.on('updater:progress', handler);
    return () => {
      ipcRenderer.removeListener('updater:progress', handler);
    };
  },
  onUpdateDownloaded: (cb: (info: { version: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { version: string }): void => {
      cb(info);
    };
    ipcRenderer.on('updater:downloaded', handler);
    return () => {
      ipcRenderer.removeListener('updater:downloaded', handler);
    };
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
