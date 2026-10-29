import { describe, it, expect } from 'vitest';
import {
  ClientDiscordConfigSetPayloadSchema,
  DiscordStateSchema,
  DiscordConfigSchema,
} from '@echo/shared';

describe('Server Discord Integration & Schemas', () => {
  it('should validate and parse Discord config', () => {
    const config = DiscordConfigSchema.parse({
      guildId: '123456789',
      echoChannelId: 'echo-chan-1',
      webhookUrl: 'https://discord.com/api/webhooks/123/xyz',
      botToken: 'bot-secret-token',
      discordChannelId: '987654321',
      enabled: true,
    });
    expect(config.guildId).toBe('123456789');
    expect(config.enabled).toBe(true);
    expect(config.webhookUrl).toBe('https://discord.com/api/webhooks/123/xyz');
  });

  it('should reject invalid payload when guildId is missing', () => {
    const res = ClientDiscordConfigSetPayloadSchema.safeParse({
      enabled: true,
    });
    expect(res.success).toBe(false);
  });

  it('should properly format DiscordState payload', () => {
    const state = DiscordStateSchema.parse({
      guildId: '12345',
      guildName: 'Gaming Community',
      instantInvite: 'https://discord.gg/xyz',
      onlineMembers: [
        {
          id: 'u-1',
          username: 'GamerOne',
          status: 'online',
          activity: 'Counter-Strike 2',
        },
      ],
      voiceChannels: [
        {
          id: 'vc-1',
          name: 'Lobby',
          members: [],
        },
      ],
      lastSyncedAt: 1700000000000,
    });

    expect(state.guildName).toBe('Gaming Community');
    expect(state.onlineMembers[0]?.username).toBe('GamerOne');
    expect(state.voiceChannels[0]?.name).toBe('Lobby');
  });
});
