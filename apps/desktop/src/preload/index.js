import { contextBridge, ipcRenderer } from 'electron';
const echoApi = {
    getAppInfo: () => {
        return ipcRenderer.invoke('app:get-info');
    },
    getIdentity: () => {
        return ipcRenderer.invoke('identity:get');
    },
    createIdentity: (displayName, avatarColor) => {
        return ipcRenderer.invoke('identity:create', { displayName, avatarColor });
    },
    signAuth: (targetId, timestamp) => {
        return ipcRenderer.invoke('identity:signAuth', { targetId, timestamp });
    },
    signPayload: (payload) => {
        return ipcRenderer.invoke('identity:signPayload', { payload });
    },
    showNotification: (options) => {
        return ipcRenderer.invoke('desktop:notify', options);
    },
    setBadgeCount: (count) => {
        return ipcRenderer.invoke('desktop:setBadge', { count });
    },
    copyToClipboard: (text) => {
        return ipcRenderer.invoke('desktop:copyToClipboard', { text });
    },
    openExternal: (url) => {
        return ipcRenderer.invoke('desktop:openExternal', { url });
    },
    getDesktopSources: () => {
        return ipcRenderer.invoke('desktop:getSources');
    },
    getLoginItemSettings: () => {
        return ipcRenderer.invoke('desktop:getLoginItemSettings');
    },
    setLoginItemSettings: (openAtLogin) => {
        return ipcRenderer.invoke('desktop:setLoginItemSettings', { openAtLogin });
    },
    checkForUpdates: async () => {
        await ipcRenderer.invoke('updater:check');
    },
    downloadUpdate: async () => {
        await ipcRenderer.invoke('updater:download');
    },
    quitAndInstall: () => {
        void ipcRenderer.invoke('updater:install');
    },
    onUpdateStatus: (cb) => {
        const handler = (_event, data) => {
            cb(data);
        };
        ipcRenderer.on('updater:status', handler);
        return () => {
            ipcRenderer.removeListener('updater:status', handler);
        };
    },
    onUpdateAvailable: (cb) => {
        const handler = (_event, info) => {
            cb(info);
        };
        ipcRenderer.on('updater:available', handler);
        return () => {
            ipcRenderer.removeListener('updater:available', handler);
        };
    },
    onUpdateProgress: (cb) => {
        const handler = (_event, progress) => {
            cb(progress);
        };
        ipcRenderer.on('updater:progress', handler);
        return () => {
            ipcRenderer.removeListener('updater:progress', handler);
        };
    },
    onUpdateDownloaded: (cb) => {
        const handler = (_event, info) => {
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
}
catch (error) {
    console.error('[Echo Preload] Failed to expose echoApi via contextBridge:', error);
    // Fallback for non-isolated context
    const globalScope = globalThis;
    globalScope['echoApi'] = echoApi;
}
