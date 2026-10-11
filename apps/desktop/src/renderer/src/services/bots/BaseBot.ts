import type { BotManifest, BotCommandDefinition } from '@echo/shared';

export interface BotCommandContext {
  groupId: string;
  channelId: string;
  senderUserId: string;
  senderDisplayName: string;
}

export abstract class BaseBot {
  public abstract readonly manifest: BotManifest;

  public get id(): string {
    return this.manifest.id;
  }

  public get name(): string {
    return this.manifest.name;
  }

  public get prefix(): string {
    return this.manifest.prefix;
  }

  public get commands(): BotCommandDefinition[] {
    return this.manifest.commands;
  }

  public matchesCommand(commandName: string): BotCommandDefinition | undefined {
    const cmd = commandName.toLowerCase();
    return this.commands.find(
      (c) => c.name.toLowerCase() === cmd || c.aliases.some((a) => a.toLowerCase() === cmd),
    );
  }

  /**
   * Handle incoming text message. Returns true if consumed by this bot.
   */
  public async handleMessage(content: string, context: BotCommandContext): Promise<boolean> {
    const trimmed = content.trim();
    if (!trimmed.startsWith(this.prefix)) {
      return false;
    }

    const withoutPrefix = trimmed.slice(this.prefix.length).trim();
    if (!withoutPrefix) return false;

    const parts = withoutPrefix.split(/\s+/);
    const commandName = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    const matched = this.matchesCommand(commandName);
    if (!matched) return false;

    return this.onCommand(matched.name, args, trimmed, context);
  }

  /**
   * Abstract method called when a recognized command is executed.
   */
  public abstract onCommand(
    command: string,
    args: string[],
    rawText: string,
    context: BotCommandContext,
  ): Promise<boolean>;

  public abstract destroy(): void;
}
