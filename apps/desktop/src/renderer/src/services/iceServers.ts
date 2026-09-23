import {
  DEFAULT_FALLBACK_ICE_SERVERS,
  TurnResponseSchema,
} from '@echo/shared';
import { SERVER_HTTP_URL } from '../config';

class IceServersService {
  private cachedIceServers: RTCIceServer[] = (DEFAULT_FALLBACK_ICE_SERVERS as unknown as RTCIceServer[]);
  private isFetching = false;
  private lastFetchedAt = 0;
  private readonly CACHE_TTL_MS = 1000 * 60 * 60; // 1 saat geçerli

  /**
   * Senkron olarak mevcut (en güncel veya yedekli) ICE / TURN yapılandırmasını döner.
   */
  getIceServers(): RTCIceServer[] {
    return [...this.cachedIceServers];
  }

  /**
   * Sunucudaki /api/turn uç noktasından TURN/STUN sunucu listesini çeker ve önbelleğe alır.
   */
  async fetchIceServers(force = false): Promise<RTCIceServer[]> {
    const now = Date.now();
    if (!force && this.lastFetchedAt > 0 && now - this.lastFetchedAt < this.CACHE_TTL_MS) {
      return this.getIceServers();
    }

    if (this.isFetching) {
      return this.getIceServers();
    }

    this.isFetching = true;
    try {
      console.log('[Echo ICE] Fetching TURN/ICE servers from:', `${SERVER_HTTP_URL}/api/turn`);
      const res = await fetch(`${SERVER_HTTP_URL}/api/turn`);
      if (res.ok) {
        const json = await res.json();
        const parsed = TurnResponseSchema.safeParse(json);
        if (parsed.success && parsed.data.iceServers.length > 0) {
          this.cachedIceServers = parsed.data.iceServers as unknown as RTCIceServer[];
          this.lastFetchedAt = Date.now();
          console.log('[Echo ICE] Successfully updated iceServers from server:', this.cachedIceServers);
        } else {
          console.warn('[Echo ICE] /api/turn returned unexpected schema, keeping fallback:', json);
        }
      } else {
        console.warn(`[Echo ICE] /api/turn returned HTTP ${res.status}, keeping fallback.`);
      }
    } catch (err) {
      console.error('[Echo ICE] Failed to fetch /api/turn, keeping fallback:', err);
    } finally {
      this.isFetching = false;
    }

    return this.getIceServers();
  }
}

export const iceServersService = new IceServersService();
