import { contextBridge, ipcRenderer } from 'electron';

export interface AppInfo {
  appName: string;
  protocolVersion: number;
  appVersion: string;
  platform: string;
}

export interface EchoApi {
  getAppInfo: () => Promise<AppInfo>;
}

const echoApi: EchoApi = {
  getAppInfo: (): Promise<AppInfo> => {
    return ipcRenderer.invoke('app:get-info');
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('echoApi', echoApi);
  } catch (error) {
    console.error('Failed to expose echoApi in main world:', error);
  }
} else {
  const globalScope = globalThis as Record<string, unknown>;
  globalScope['echoApi'] = echoApi;
}
