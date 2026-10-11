import { describe, it, expect } from 'vitest';
import {
  BotManifestSchema,
  BotCommandInvokePayloadSchema,
  BotStateUpdatePayloadSchema,
  type BotManifest,
} from '../schemas/bot';
import { VoiceParticipantSchema } from '../schemas/voice';

describe('Bot Infrastructure Schemas', () => {
  it('validates a complete bot manifest', () => {
    const musicBotManifest: BotManifest = {
      id: 'bot-music',
      name: 'Echo Müzik',
      description: 'Yüksek kaliteli Discord tarzı WebRTC müzik botu',
      avatarUrl: 'https://cdn.echo.app/bots/music.png',
      type: 'music',
      capabilities: ['voice', 'chat_commands', 'audio_stream'],
      prefix: '!',
      color: '#8b5cf6',
      commands: [
        {
          name: 'play',
          description: 'Bir şarkı çalar veya sıraya ekler',
          usage: '!play <şarkı adı veya link>',
          aliases: ['p', 'çal'],
        },
        {
          name: 'skip',
          description: 'Çalan şarkıyı atlar',
          aliases: ['s', 'atla'],
        },
        {
          name: 'stop',
          description: 'Müziği durdurur ve kanaldan ayrılır',
          aliases: ['durdur'],
        },
      ],
    };

    const parsed = BotManifestSchema.safeParse(musicBotManifest);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe('music');
      expect(parsed.data.commands.length).toBe(3);
      expect(parsed.data.commands[0]?.aliases).toContain('çal');
    }
  });

  it('validates bot command invocation payload', () => {
    const valid = BotCommandInvokePayloadSchema.safeParse({
      channelId: 'chan-general',
      botId: 'bot-music',
      command: 'play',
      args: ['Duman', 'Kırmış', 'Kalbini'],
      rawText: '!play Duman Kırmış Kalbini',
    });
    expect(valid.success).toBe(true);

    const invalid = BotCommandInvokePayloadSchema.safeParse({
      channelId: '',
      botId: 'bot-music',
      command: '',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates bot state update payload', () => {
    const valid = BotStateUpdatePayloadSchema.safeParse({
      channelId: 'voice-room-1',
      botId: 'bot-music',
      statusText: '🎵 Duman - Kırmış Kalbini çalıyor',
      activity: 'music',
      isSpeaking: true,
      metadata: { volume: 80, trackId: '12345' },
    });
    expect(valid.success).toBe(true);
  });

  it('validates voice participant with bot attributes', () => {
    const botParticipant = VoiceParticipantSchema.safeParse({
      userId: 'bot-music-voice-room-1',
      displayName: 'Echo Müzik',
      muted: false,
      deafened: false,
      speaking: true,
      camera: false,
      isBot: true,
      botId: 'bot-music',
      botType: 'music',
    });
    expect(botParticipant.success).toBe(true);
    if (botParticipant.success) {
      expect(botParticipant.data.isBot).toBe(true);
      expect(botParticipant.data.botId).toBe('bot-music');
    }
  });
});
