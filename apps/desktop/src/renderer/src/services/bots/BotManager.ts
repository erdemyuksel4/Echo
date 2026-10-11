import { BaseBot, type BotCommandContext } from './BaseBot';
import { VoiceBot } from './VoiceBot';
import { musicBot } from './MusicBot';
import type { VoiceSignalData, BotManifest } from '@echo/shared';

class BotManager {
  private bots: Map<string, BaseBot> = new Map();

  constructor() {
    this.registerBot(musicBot);
  }

  public registerBot(bot: BaseBot): void {
    this.bots.set(bot.id, bot);
  }

  public getBot(id: string): BaseBot | undefined {
    return this.bots.get(id);
  }

  public getAllBots(): BotManifest[] {
    return Array.from(this.bots.values()).map((b) => b.manifest);
  }

  public async handleMessage(content: string, context: BotCommandContext): Promise<boolean> {
    for (const bot of this.bots.values()) {
      const handled = await bot.handleMessage(content, context);
      if (handled) return true;
    }
    return false;
  }

  public handleBotSignal(botId: string, fromUserId: string, signal: VoiceSignalData): void {
    const bot = this.bots.get(botId);
    if (bot && bot instanceof VoiceBot) {
      bot.handleIncomingSignal(fromUserId, signal);
    }
  }

  public handleUserLeft(userId: string): void {
    for (const bot of this.bots.values()) {
      if (bot instanceof VoiceBot) {
        bot.handleUserLeft(userId);
      }
    }
  }

  public syncHostStatus(isHost: boolean, channelId: string | null): void {
    for (const bot of this.bots.values()) {
      if (bot instanceof VoiceBot) {
        if (channelId) {
          bot.joinVoice(channelId);
          bot.setHostStatus(isHost);
        } else {
          bot.leaveVoice();
          bot.setHostStatus(false);
        }
      }
    }
  }
}

export const botManager = new BotManager();
