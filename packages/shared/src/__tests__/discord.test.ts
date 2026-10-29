import { describe, it, expect } from 'vitest';
import {
  DiscordMemberSchema,
  DiscordVoiceChannelSchema,
  DiscordStateSchema,
  DiscordConfigSchema,
  ClientDiscordConfigSetPayloadSchema,
  ServerDiscordConfigPayloadSchema,
} from '../schemas/discord';
import { ChannelSchema } from '../schemas/group';

describe('Discord Schemas', () => {
  it('should validate a discord member', () => {
    const member = DiscordMemberSchema.parse({
      id: '1234567890',
      username: 'TestUser',
      status: 'online',
      activity: 'Playing Minecraft',
      mute: false,
      deaf: false,
    });
    expect(member.username).toBe('TestUser');
    expect(member.status).toBe('online');
    expect(member.activity).toBe('Playing Minecraft');
  });

  it('should validate a discord voice channel with participants', () => {
    const channel = DiscordVoiceChannelSchema.parse({
      id: 'vc-1',
      name: 'Genel Ses',
      members: [
        {
          id: 'u1',
          username: 'Ahmet',
          status: 'online',
          channelId: 'vc-1',
        },
      ],
    });
    expect(channel.name).toBe('Genel Ses');
    expect(channel.members.length).toBe(1);
    expect(channel.members[0]?.username).toBe('Ahmet');
  });

  it('should validate discord state snapshot', () => {
    const state = DiscordStateSchema.parse({
      guildId: '987654321',
      guildName: 'Arkadaş Grubu',
      onlineMembers: [
        { id: '1', username: 'Ali', status: 'idle' },
      ],
      voiceChannels: [
        { id: 'v1', name: 'Oyun Odası', members: [] },
      ],
      lastSyncedAt: Date.now(),
    });
    expect(state.guildName).toBe('Arkadaş Grubu');
    expect(state.onlineMembers[0]?.status).toBe('idle');
  });

  it('should validate config schema and set payload with syncAllChannels', () => {
    const config = DiscordConfigSchema.parse({
      guildId: '1234567890',
      echoChannelId: 'echo-c1',
      syncAllChannels: true,
      enabled: true,
    });
    expect(config.guildId).toBe('1234567890');
    expect(config.syncAllChannels).toBe(true);

    const payload = ClientDiscordConfigSetPayloadSchema.parse({
      guildId: '1234567890',
      echoChannelId: 'echo-c1',
      webhookUrl: 'https://discord.com/api/webhooks/123/xyz',
      botToken: 'bot.token.here',
      syncAllChannels: true,
      enabled: true,
    });
    expect(payload.guildId).toBe('1234567890');
    expect(payload.syncAllChannels).toBe(true);
    expect(payload.enabled).toBe(true);

    const serverPayload = ServerDiscordConfigPayloadSchema.parse({
      guildId: '1234567890',
      hasWebhook: true,
      hasBotToken: true,
      syncAllChannels: true,
      enabled: true,
    });
    expect(serverPayload.hasBotToken).toBe(true);
  });

  it('should validate channel schema with discordChannelId', () => {
    const chan = ChannelSchema.parse({
      id: 'chan-1',
      groupId: 'g-1',
      name: 'sohbet',
      type: 'text',
      position: 0,
      createdAt: Date.now(),
      discordChannelId: '123456789',
    });
    expect(chan.discordChannelId).toBe('123456789');
  });
});
