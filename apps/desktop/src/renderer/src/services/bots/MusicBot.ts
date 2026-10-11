import { VoiceBot } from './VoiceBot';
import type { BotManifest } from '@echo/shared';
import { wsService } from '../websocket';
import { SERVER_HTTP_URL } from '../../config';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { useMusicStore } from '../../stores/useMusicStore';
import { useAuthStore } from '../../stores/useAuthStore';
import type { MusicTrack } from '@echo/shared';

export class MusicBot extends VoiceBot {
  public override readonly manifest: BotManifest = {
    id: 'bot-music',
    name: 'Echo Müzik',
    description: 'Discord tarzı yüksek kaliteli WebRTC müzik botu',
    avatarUrl: '',
    type: 'music',
    capabilities: ['voice', 'chat_commands', 'audio_stream'],
    prefix: '!',
    color: '#8b5cf6',
    commands: [
      {
        name: 'play',
        description: 'Şarkı arar ve çalar veya sıraya ekler',
        usage: '!play <şarkı adı veya YouTube linki>',
        aliases: ['p', 'çal', 'oynat'],
      },
      {
        name: 'pause',
        description: 'Çalan şarkıyı duraklatır',
        usage: '!pause',
        aliases: ['duraklat', 'beklet'],
      },
      {
        name: 'resume',
        description: 'Duraklatılan şarkıyı devam ettirir',
        usage: '!resume',
        aliases: ['devam'],
      },
      {
        name: 'skip',
        description: 'Sıradaki şarkıya geçer',
        usage: '!skip',
        aliases: ['s', 'atla', 'geç'],
      },
      {
        name: 'stop',
        description: 'Müziği tamamen durdurur ve sırayı temizler',
        usage: '!stop',
        aliases: ['durdur', 'kapat'],
      },
      {
        name: 'queue',
        description: 'Çalma kuyruğunu gösterir',
        usage: '!queue',
        aliases: ['q', 'kuyruk', 'sıra'],
      },
      {
        name: 'help',
        description: 'Kullanılabilir bot komutlarını listeler',
        usage: '!help',
        aliases: ['yardım', 'komutlar', 'h'],
      },
    ],
  };

  private audioCtx: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;

  public initAudioPipeline(): MediaStreamTrack | null {
    try {
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (!this.audioDestination) {
        this.audioDestination = this.audioCtx.createMediaStreamDestination();
      }
      const track = this.audioDestination.stream.getAudioTracks()[0] ?? null;
      this.setAudioTrack(track);
      return track;
    } catch (err) {
      console.warn('[MusicBot] Failed to initialize audio pipeline:', err);
      return null;
    }
  }

  public override async onCommand(
    command: string,
    args: string[],
    _rawText: string,
    context: { channelId: string; groupId: string },
  ): Promise<boolean> {
    const currentVoiceChannelId = useVoiceStore.getState().currentChannelId || context.channelId;
    if (!currentVoiceChannelId) return false;

    switch (command) {
      case 'play': {
        const query = args.join(' ').trim();
        if (!query) {
          this.postNotice(context.channelId, '⚠️ Lütfen çalmak istediğiniz şarkının adını veya linkini yazın: `!play <şarkı>`');
          return true;
        }

        this.postNotice(context.channelId, `🔍 **"${query}"** aranıyor...`);
        try {
          const res = await fetch(`${SERVER_HTTP_URL}/api/music/search?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = (await res.json()) as { results: MusicTrack[] };
            const track = data.results?.[0];
            if (track) {
              const identity = useAuthStore.getState().identity;
              const fullTrack: MusicTrack = {
                ...track,
                addedByUserId: identity?.userId || 'unknown',
                addedByName: identity?.displayName || 'Kullanıcı',
              };

              const currentPlayback = useMusicStore.getState().getChannelPlayback(currentVoiceChannelId);
              if (currentPlayback && currentPlayback.status === 'playing') {
                wsService.sendMusicAction({
                  action: 'queue_add',
                  channelId: currentVoiceChannelId,
                  track: fullTrack,
                });
                this.postNotice(context.channelId, `🎵 **${track.title}** sıraya eklendi.`);
              } else {
                wsService.sendMusicAction({
                  action: 'play',
                  channelId: currentVoiceChannelId,
                  track: fullTrack,
                });
                this.postNotice(context.channelId, `▶️ Şimdi çalıyor: **${track.title}**`);
              }
            } else {
              this.postNotice(context.channelId, `❌ **"${query}"** için sonuç bulunamadı.`);
            }
          }
        } catch {
          this.postNotice(context.channelId, '❌ Şarkı aranırken bir hata oluştu.');
        }
        return true;
      }

      case 'pause': {
        wsService.sendMusicAction({ action: 'pause', channelId: currentVoiceChannelId });
        this.postNotice(context.channelId, '⏸️ Müzik duraklatıldı.');
        return true;
      }

      case 'resume': {
        wsService.sendMusicAction({ action: 'resume', channelId: currentVoiceChannelId });
        this.postNotice(context.channelId, '▶️ Müzik devam ettiriliyor.');
        return true;
      }

      case 'skip': {
        wsService.sendMusicAction({ action: 'skip', channelId: currentVoiceChannelId });
        this.postNotice(context.channelId, '⏭️ Sıradaki şarkıya geçildi.');
        return true;
      }

      case 'stop': {
        wsService.sendMusicAction({ action: 'stop', channelId: currentVoiceChannelId });
        this.postNotice(context.channelId, '⏹️ Müzik durduruldu ve sıra temizlendi.');
        return true;
      }

      case 'queue': {
        const state = useMusicStore.getState().getChannelPlayback(currentVoiceChannelId);
        if (!state || (!state.currentTrack && state.queue.length === 0)) {
          this.postNotice(context.channelId, '📭 Çalma kuyruğu şu anda boş.');
          return true;
        }

        let msg = '📜 **Müzik Kuyruğu:**\n';
        if (state.currentTrack) {
          msg += `▶️ **Şimdi Çalıyor:** ${state.currentTrack.title} (${state.currentTrack.duration})\n`;
        }
        if (state.queue.length > 0) {
          msg += state.queue
            .slice(0, 5)
            .map((t, i) => `${i + 1}. ${t.title} (${t.duration})`)
            .join('\n');
          if (state.queue.length > 5) {
            msg += `\n...ve ${state.queue.length - 5} şarkı daha`;
          }
        }
        this.postNotice(context.channelId, msg);
        return true;
      }

      case 'help': {
        let helpMsg = '🤖 **Echo Müzik Botu Komutları:**\n';
        for (const cmd of this.commands) {
          helpMsg += `• \`${cmd.usage || `${this.prefix}${cmd.name}`}\` — ${cmd.description}\n`;
        }
        this.postNotice(context.channelId, helpMsg);
        return true;
      }

      default:
        return false;
    }
  }

  private postNotice(channelId: string, content: string): void {
    const groupId = useVoiceStore.getState().currentGroupId;
    if (groupId) {
      wsService.sendMessage(groupId, channelId, content);
    }
  }

  public override destroy(): void {
    super.destroy();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
    this.audioDestination = null;
  }
}

export const musicBot = new MusicBot();
