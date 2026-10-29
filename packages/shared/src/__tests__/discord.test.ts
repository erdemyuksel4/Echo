import { describe, it, expect } from 'vitest';
import {
  DiscordMemberSchema,
  DiscordVoiceChannelSchema,
  DiscordStateSchema,
  DiscordConfigSchema,
  ClientDiscordConfigSetPayloadSchema,
} from '../schemas/discord';

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

  it('should validate config schema and set payload', () => {
    const config = DiscordConfigSchema.parse({
      guildId: '1234567890',
      echoChannelId: 'echo-c1',
      enabled: true,
    });
    expect(config.guildId).toBe('1234567890');

    const payload = ClientDiscordConfigSetPayloadSchema.parse({
      guildId: '1234567890',
      echoChannelId: 'echo-c1',
      webhookUrl: 'https://discord.com/api/webhooks/123/xyz',
      enabled: true,
    });
    expect(payload.guildId).toBe('1234567890');
    expect(payload.enabled).toBe(true);
  });
});
