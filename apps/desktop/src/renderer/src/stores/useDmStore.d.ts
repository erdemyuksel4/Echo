import type { DmThread, DmMessage } from '@echo/shared';
export interface ActivePeer {
    peerId: string;
    peerName: string;
    peerColor: string;
}
interface DmState {
    threads: DmThread[];
    messages: Record<string, DmMessage[]>;
    activePeer: ActivePeer | null;
    hasMoreHistory: Record<string, boolean>;
    setThreads: (threads: DmThread[]) => void;
    setActivePeer: (peer: ActivePeer | null) => void;
    addMessage: (msg: DmMessage, myUserId: string) => void;
    setMessages: (peerId: string, msgs: DmMessage[]) => void;
    prependMessages: (peerId: string, msgs: DmMessage[]) => void;
    markThreadRead: (peerId: string) => void;
    clearUnread: (peerId: string) => void;
}
export declare const useDmStore: import("zustand").UseBoundStore<import("zustand").StoreApi<DmState>>;
export {};
