import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { HabitsService } from '../habits/habits.service';
import { OpenAiService } from '../../shared/openai/openai.service';
import { InteractionsService } from '../interactions/interactions.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly habitsService: HabitsService,
    private readonly openAi: OpenAiService,
    private readonly interactions: InteractionsService,
  ) {}

  async getThread(
    userId: string,
    localDate?: string,
    localTime?: string,
    timeZone?: string,
  ) {
    await this.interactions.rememberTimeZone(userId, timeZone);
    const date = localDate || this.fallbackDate();
    const time = localTime || this.fallbackTime();

    let user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    if (!user.onboardingCompleted) {
      throw new BadRequestException('Completa el onboarding primero.');
    }

    // Bienvenida si hace falta
    await this.ensureWelcome(userId, user);
    // Trillizo T-10
    user = (await this.interactions.syncT10(userId, date, time)) || user;
    user = (await this.usersService.findById(userId))!;

    const state = this.interactions.buildInteractionState(user);
    return {
      messages: this.interactions.mapMessages(user.chatMessages || []),
      welcomeCompleted: !!user.welcomeCompleted,
      canInteract: state.canInteract,
      restMode: state.restMode,
      actions: state.actions,
      localDate: date,
      goldenHour: user.goldenHour || null,
    };
  }

  async thankWelcome(
    userId: string,
    localDate?: string,
    localTime?: string,
    timeZone?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');

    if (!user.welcomeCompleted) {
      const now = new Date();
      await this.usersService.appendChatMessages(userId, [
        { role: 'user', text: 'Gracias', createdAt: now },
        {
          role: 'assistant',
          text: 'De nada. Aquí seguiremos, un día a la vez. Cuando sea momento, te avisaré.',
          createdAt: new Date(now.getTime() + 800),
        },
      ]);
      await this.usersService.markWelcomeCompleted(userId);
    }

    return this.getThread(userId, localDate, localTime, timeZone);
  }

  async action(
    userId: string,
    action: string,
    localDate: string,
    opts?: {
      newGoldenHour?: string;
      adminBypass?: boolean;
      localTime?: string;
      timeZone?: string;
    },
  ) {
    if (action === 'gracias') {
      return this.thankWelcome(
        userId,
        localDate,
        opts?.localTime,
        opts?.timeZone,
      );
    }
    await this.interactions.handleAction(userId, action, localDate, opts);
    return this.getThread(userId, localDate, opts?.localTime, opts?.timeZone);
  }

  async clearChat(
    userId: string,
    localDate?: string,
    localTime?: string,
    timeZone?: string,
  ) {
    await this.usersService.clearChat(userId);
    return this.getThread(userId, localDate, localTime, timeZone);
  }

  private async ensureWelcome(userId: string, user: any) {
    let messages = [...(user.chatMessages || [])];

    if (!messages.length && user.welcomeMessage) {
      messages = [
        {
          role: 'assistant' as const,
          text: user.welcomeMessage,
          createdAt: user.updatedAt || new Date(),
        },
      ];
      await this.usersService.setChatMessages(userId, messages);
      return;
    }

    if (!messages.length) {
      this.logger.log(`Generando bienvenida IA para user=${userId}`);
      const text = await this.generateWelcomeText(user);
      const welcomeMsg = {
        role: 'assistant' as const,
        text,
        createdAt: new Date(),
      };
      await this.usersService.saveWelcomeMessage(userId, text);
      await this.usersService.setChatMessages(userId, [welcomeMsg]);
    }
  }

  private async generateWelcomeText(user: any) {
    const group = user.habitGroupId
      ? await this.habitsService.findGroupById(String(user.habitGroupId))
      : user.habitGroupKey
        ? await this.habitsService.findGroupByKey(user.habitGroupKey)
        : null;

    const rag = group
      ? await this.habitsService.getRagByGroupKey(group.key, 4)
      : [];

    return this.openAi.generateWelcomeMessage({
      name: user.name,
      habitRaw: user.habitRaw || user.habitGroupName || 'tu hábito',
      identityTitle: user.identityTitle,
      identityRole: user.identityRole,
      groupName: user.habitGroupName || group?.name,
      scopePrompt: group?.scopePrompt,
      ragSnippets: rag.map((c) => `${c.title}: ${c.content}`),
    });
  }

  private fallbackDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private fallbackTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}
