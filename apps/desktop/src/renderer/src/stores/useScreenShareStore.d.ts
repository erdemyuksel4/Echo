import type { ScreenShareState, ScreenQualityPreset } from '@echo/shared';
export interface ViewingShareState {
    userId: string;
    displayName: string;
    stream: MediaStream | null;
    isLoading: boolean;
}
interface ScreenShareStoreState {
    isSharing: boolean;
    localStream: MediaStream | null;
    activeShares: ScreenShareState[];
    viewingShare: ViewingShareState | null;
    viewerCount: number;
    isModalViewerOpen: boolean;
    viewerVolume: number;
    isViewerMuted: boolean;
    setViewerVolume: (volume: number) => void;
    setIsViewerMuted: (isMuted: boolean) => void;
    setIsSharing: (sharing: boolean, stream?: MediaStream | null) => void;
    setActiveShares: (shares: ScreenShareState[]) => void;
    addOrUpdateShare: (share: ScreenShareState) => void;
    removeShare: (userId: string) => void;
    setViewingShare: (viewing: ViewingShareState | null) => void;
    setViewerCount: (count: number) => void;
    openModalViewer: () => void;
    closeModalViewer: () => void;
    startSharing: (channelId: string, stream: MediaStream, quality: ScreenQualityPreset, mode: 'motion' | 'detail', hasAudio: boolean) => Promise<void>;
    stopSharing: (channelId: string) => Promise<void>;
    watchStream: (targetUserId: string, displayName: string, channelId: string) => Promise<void>;
    stopWatching: () => void;
}
export declare const useScreenShareStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ScreenShareStoreState>>;
export {};
