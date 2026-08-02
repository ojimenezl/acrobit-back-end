import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isValidTimeZone } from '../../shared/time/local-clock';

const T10_TEXT =
  'Faltan 10 minutos para empezar tu hábito. Ánimo, hoy es el día.';

const REPLY = {
  si: 'Perfecto. En 10 minutos nos vemos.',
  no: 'Está bien. A veces el cuerpo pide pausa. ¿Y si lo intentas solo 5 minutos?',
  intentar_5: 'Perfecto. En 10 minutos nos vemos; solo te tomará 5 minutos.',
  no_puedo:
    'No pasa nada. La paciencia también es saber cuidarte hoy. Mañana seguimos.',
  reprogramar: 'Listo. Nueva Hora de Oro guardada. Hoy ya está. Puedes salir tranquilo.',
} as const;

export type ChatAction =
  | 'gracias'
  | 'si'
  | 'no'
  | 'reprogramar'
  | 'intentar_5'
  | 'no_puedo';

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);

  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Guarda la zona horaria del cliente para el cron T-10. */
  async rememberTimeZone(userId: string, timeZone?: string) {
    if (!isValidTimeZone(timeZone)) return;
    const user = await this.usersService.findById(userId);
    if (!user) return;
    if (user.timeZone === timeZone) return;
    await this.usersService.updateTimeZone(userId, timeZone);
  }

  /**
   * Si ya pasó T-10 de la Hora de Oro y aún no hay prompt hoy → crea el aviso
   * en chat + feed + push (trillizos). También reintenta push si falló antes.
   */
  async syncT10(userId: string, localDate: string, localTime: string) {
    this.assertDate(localDate);
    const time = this.normalizeTime(localTime);
    const user = await this.requireUser(userId);

    if (!user.welcomeCompleted || !user.goldenHour) return user;

    const existing = user.dailyInteraction;
    if (existing?.localDate === localDate && existing.kind === 't10') {
      if (
        !existing.pushSent &&
        user.notificationsEnabled &&
        Array.isArray(user.fcmTokens) &&
        user.fcmTokens.length > 0
      ) {
        await this.trySendT10Push(
          userId,
          existing.promptText || T10_TEXT,
          localDate,
          existing,
        );
      }
      return this.usersService.findById(userId);
    }

    const t10 = this.minusMinutes(user.goldenHour, 10);
    if (this.timeToMinutes(time) < this.timeToMinutes(t10)) {
      return user;
    }

    const promptText = T10_TEXT;
    const dailyInteraction = {
      localDate,
      kind: 't10' as const,
      stage: 'primary' as const,
      promptText,
      actions: ['si', 'no', 'reprogramar'],
      pushSent: false,
    };

    const msg = {
      role: 'assistant' as const,
      text: promptText,
      createdAt: new Date(),
    };

    await this.usersService.appendTripletMessages(userId, [msg]);
    await this.usersService.setDailyInteraction(userId, dailyInteraction);
    await this.trySendT10Push(userId, promptText, localDate, dailyInteraction);

    return this.usersService.findById(userId);
  }

  /** Resuelve acciones del trillizo (sí/no/reprogramar/…). */
  async handleAction(
    userId: string,
    action: string,
    localDate: string,
    opts?: { newGoldenHour?: string; adminBypass?: boolean },
  ) {
    this.assertDate(localDate);
    const user = await this.requireUser(userId);
    const di = user.dailyInteraction;

    if (!di || di.localDate !== localDate || di.stage === 'done') {
      throw new BadRequestException('No hay una interacción activa.');
    }
    if (!di.actions.includes(action)) {
      throw new BadRequestException('Acción no disponible.');
    }

    const now = new Date();

    if (action === 'si') {
      await this.appendPair(userId, 'Sí', REPLY.si, now);
      await this.usersService.setDailyInteraction(userId, {
        ...di,
        stage: 'done',
        actions: [],
      });
      return;
    }

    if (action === 'no') {
      await this.appendPair(userId, 'No', REPLY.no, now);
      await this.usersService.setDailyInteraction(userId, {
        ...di,
        stage: 'after_no',
        actions: ['intentar_5', 'no_puedo'],
      });
      return;
    }

    if (action === 'intentar_5') {
      await this.appendPair(userId, 'Lo voy a intentar por 5 min', REPLY.intentar_5, now);
      await this.usersService.setDailyInteraction(userId, {
        ...di,
        stage: 'done',
        actions: [],
      });
      return;
    }

    if (action === 'no_puedo') {
      await this.appendPair(userId, 'Realmente no puedo', REPLY.no_puedo, now);
      await this.usersService.setDailyInteraction(userId, {
        ...di,
        stage: 'done',
        actions: [],
      });
      return;
    }

    if (action === 'reprogramar') {
      const time = opts?.newGoldenHour;
      if (!time) {
        throw new BadRequestException('Indica la nueva Hora de Oro.');
      }
      const normalized = this.normalizeTime(time);
      // Reprogramar desde T-10 siempre puede cambiar la hora (persiste en BD).
      await this.usersService.updateGoldenHour(userId, normalized, localDate);
      await this.appendPair(
        userId,
        `Reprogramar → ${normalized}`,
        REPLY.reprogramar,
        now,
      );
      await this.usersService.setDailyInteraction(userId, {
        ...di,
        stage: 'done',
        actions: [],
      });
    }
  }

  buildInteractionState(user: any) {
    if (!user.welcomeCompleted) {
      return {
        canInteract: true,
        actions: ['gracias'] as string[],
        restMode: false,
      };
    }

    const di = user.dailyInteraction;
    if (di && di.stage !== 'done' && Array.isArray(di.actions) && di.actions.length) {
      return {
        canInteract: true,
        actions: di.actions as string[],
        restMode: false,
      };
    }

    return {
      canInteract: false,
      actions: [] as string[],
      restMode: true,
    };
  }

  mapMessages(messages: any[] = []) {
    return messages.map((m: any) => ({
      id: String(m._id || `${m.role}-${new Date(m.createdAt).getTime()}`),
      role: m.role as 'assistant' | 'user',
      text: m.text as string,
      createdAt: new Date(m.createdAt).toISOString(),
    }));
  }

  async getNotificationsInbox(
    userId: string,
    localDate?: string,
    localTime?: string,
    timeZone?: string,
  ) {
    await this.rememberTimeZone(userId, timeZone);
    const date = localDate || this.fallbackDate();
    const time = localTime || this.fallbackTime();
    await this.syncT10(userId, date, time);
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');

    const state = this.buildInteractionState(user);
    return {
      messages: this.mapMessages(user.notificationFeed || []),
      canInteract: state.canInteract && state.actions.every((a) => a !== 'gracias'),
      restMode: state.restMode || !user.welcomeCompleted,
      actions: state.actions.filter((a) => a !== 'gracias'),
      localDate: date,
      goldenHour: user.goldenHour || null,
    };
  }

  private async trySendT10Push(
    userId: string,
    promptText: string,
    localDate: string,
    dailyInteraction: {
      localDate: string;
      kind: 't10';
      stage: string;
      promptText: string;
      actions: string[];
      pushSent: boolean;
    },
  ) {
    try {
      const result = await this.notificationsService.sendToUser(userId, {
        title: 'ACROBIT',
        body: `${promptText} [Sí] [No] [Reprogramar]`,
        data: { type: 't10', localDate },
      });
      if ((result?.sent ?? 0) > 0) {
        await this.usersService.setDailyInteraction(userId, {
          ...dailyInteraction,
          pushSent: true,
        });
      }
    } catch (err: any) {
      this.logger.warn(`Push T-10 no enviado: ${err?.message}`);
    }
  }

  private fallbackDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private fallbackTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  private async appendPair(
    userId: string,
    userText: string,
    assistantText: string,
    now: Date,
  ) {
    await this.usersService.appendTripletMessages(userId, [
      { role: 'user', text: userText, createdAt: now },
      {
        role: 'assistant',
        text: assistantText,
        createdAt: new Date(now.getTime() + 600),
      },
    ]);
  }

  private minusMinutes(hhmm: string, mins: number) {
    const total = this.timeToMinutes(hhmm) - mins;
    const safe = ((total % 1440) + 1440) % 1440;
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private timeToMinutes(hhmm: string) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  normalizeTime(raw: string) {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(raw || '').trim());
    if (!match) throw new BadRequestException('Usa una hora válida (ej. 18:00).');
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  private assertDate(localDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate || '')) {
      throw new BadRequestException('Fecha local inválida.');
    }
  }

  private async requireUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    if (!user.onboardingCompleted) {
      throw new BadRequestException('Completa el onboarding primero.');
    }
    return user;
  }
}
