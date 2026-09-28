declare class IceServersService {
    private cachedIceServers;
    private isFetching;
    private lastFetchedAt;
    private readonly CACHE_TTL_MS;
    /**
     * Senkron olarak mevcut (en güncel veya yedekli) ICE / TURN yapılandırmasını döner.
     */
    getIceServers(): RTCIceServer[];
    /**
     * Sunucudaki /api/turn uç noktasından TURN/STUN sunucu listesini çeker ve önbelleğe alır.
     */
    fetchIceServers(force?: boolean): Promise<RTCIceServer[]>;
}
export declare const iceServersService: IceServersService;
export {};
