import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { Logro, LogroDocument } from './schemas/logro.schema';

export const MOTIVATORS = [
  {
    key: 'gem' as const,
    title: 'Pulir una gema',
    latin: 'GEMMA',
    hint: 'Cada día quita una impureza.',
  },
  {
    key: 'sword' as const,
    title: 'Forjar una espada',
    latin: 'GLADIUS',
    hint: 'El fuego y el tiempo dan forma.',
  },
  {
    key: 'bonsai' as const,
    title: 'Cultivar un bonsái',
    latin: 'ARBOR',
    hint: 'Crece lento, pero crece cierto.',
  },
  {
    key: 'diamond' as const,
    title: 'Formar un diamante',
    latin: 'ADAMAS',
    hint: 'La presión paciente hace lo eterno.',
  },
];

export type MotivatorKey = (typeof MOTIVATORS)[number]['key'];
export type PlaqueTone = 'gold' | 'black' | 'locked';

@Injectable()
export class AchievementService {
  constructor(
    private readonly usersService: UsersService,
    @InjectModel(Logro.name) private readonly logroModel: Model<LogroDocument>,
  ) {}

  async getState(userId: string, localDate?: string) {
    const date = localDate || this.fallbackDate();
    this.assertDate(date);
    await this.touchCalendar(userId, date);

    const user = await this.requireUser(userId);
    const selected = (user.motivatorObject as MotivatorKey | undefined) || null;
    const logroDay = Math.max(1, user.logroDay || 1);
    const wonDays = new Set((user.logroWonDays || []).map(Number));
    const userName = user.name || 'tú';

    let journey: {
      element: MotivatorKey;
      title: string;
      latin: string;
      hint: string;
      logroDay: number;
      days: Array<{
        day: number;
        elementText: string;
        userText: string;
        tone: PlaqueTone;
      }>;
    } | null = null;

    if (selected) {
      const doc = await this.logroModel.findOne({ element: selected }).lean().exec();
      const days = [...(doc?.days || [])]
        .sort((a, b) => a.day - b.day)
        .map((d) => ({
          day: d.day,
          elementText: d.elementText,
          userText: this.withName(d.userText, userName),
          tone: this.plaqueTone(d.day, logroDay, wonDays),
        }));
      const meta = MOTIVATORS.find((m) => m.key === selected)!;
      journey = {
        element: selected,
        title: meta.title,
        latin: meta.latin,
        hint: meta.hint,
        logroDay,
        days,
      };
    }

    return {
      selected,
      canChoose: !selected,
      logroDay,
      habitDay: Math.max(1, user.habitDay || 1),
      userName,
      motivators: MOTIVATORS.map((m) => ({
        ...m,
        selected: selected === m.key,
      })),
      journey,
    };
  }

  async choose(userId: string, key: string, adminBypass = false) {
    const valid = MOTIVATORS.some((m) => m.key === key);
    if (!valid) throw new BadRequestException('Objeto inválido.');

    const user = await this.requireUser(userId);
    if (user.motivatorObject && !adminBypass) {
      throw new BadRequestException('Ya elegiste tu objeto de paciencia.');
    }

    await this.usersService.setMotivatorObject(userId, key as MotivatorKey);
    // Primera elección o cambio admin → progreso desde día 1
    await this.usersService.resetLogroProgress(userId);
    return this.getState(userId);
  }

  /**
   * Sincroniza Logro con el estado de Hoy.
   * - won → plaquita dorada + resetea días sin avanzar (la nueva frase sale al día siguiente)
   * - missed → se queda en el mismo día, +1 día sin avanzar (1 vez / fecha local)
   * - ask → no avanza
   */
  async syncFromTodayStatus(
    userId: string,
    localDate: string,
    status: 'ask' | 'won' | 'missed',
  ) {
    this.assertDate(localDate);
    await this.touchCalendar(userId, localDate);
    const user = await this.usersService.findById(userId);
    if (!user?.motivatorObject) return;

    const logroDay = Math.max(1, user.logroDay || 1);
    const wonDays = [...(user.logroWonDays || [])].map(Number);

    if (status === 'won') {
      if (user.logroLastAdvanceOn === localDate) return;
      if (!wonDays.includes(logroDay)) wonDays.push(logroDay);
      await this.usersService.updateLogroProgress(userId, {
        logroWonDays: wonDays.sort((a, b) => a - b),
        logroDaysWithoutAdvance: 0,
        logroLastAdvanceOn: localDate,
      });
      return;
    }

    if (status === 'missed') {
      if (user.logroLastAdvanceOn === localDate) return;
      if (user.logroStagnationOn === localDate) return;
      await this.usersService.updateLogroProgress(userId, {
        logroDaysWithoutAdvance: Math.max(0, user.logroDaysWithoutAdvance || 0) + 1,
        logroStagnationOn: localDate,
      });
    }
  }

  /**
   * Cambio de fecha local:
   * - si hubo “Lo logré” en un día anterior y aún no se desbloqueó la frase → avanza logroDay
   * - si el calendario saltó un día sin victoria pendiente → +1 al contador oculto
   *
   * Importante: también recupera usuarios “atascados” cuando logroCalendarOn
   * ya es hoy pero el avance de frase nunca se aplicó.
   */
  async touchCalendar(userId: string, localDate: string) {
    this.assertDate(localDate);
    const user = await this.usersService.findById(userId);
    if (!user?.motivatorObject) return;

    const prev = user.logroCalendarOn;
    const won = (user.logroWonDays || []).map(Number);
    const logroDay = Math.max(1, user.logroDay || 1);
    const lastAdvance = user.logroLastAdvanceOn || '';
    const maxWon = won.length ? Math.max(...won) : 0;

    const patch: {
      logroCalendarOn?: string;
      logroDay?: number;
      logroDaysWithoutAdvance?: number;
      logroStagnationOn?: string;
    } = {};

    // Victoria de un día anterior aún no reflejada en el cursor de frases
    const pendingWin =
      !!lastAdvance &&
      lastAdvance < localDate &&
      maxWon > 0 &&
      logroDay <= maxWon;

    if (pendingWin) {
      patch.logroDay = maxWon + 1;
    } else if (
      prev &&
      prev < localDate &&
      lastAdvance !== prev &&
      user.logroStagnationOn !== prev
    ) {
      patch.logroDaysWithoutAdvance =
        Math.max(0, user.logroDaysWithoutAdvance || 0) + 1;
      patch.logroStagnationOn = prev;
    }

    if (prev !== localDate) {
      patch.logroCalendarOn = localDate;
    }

    if (Object.keys(patch).length) {
      await this.usersService.updateLogroProgress(userId, patch);
    }
  }

  private plaqueTone(
    day: number,
    logroDay: number,
    wonDays: Set<number>,
  ): PlaqueTone {
    if (wonDays.has(day)) return 'gold';
    if (day === logroDay) return 'black';
    if (day < logroDay) return 'gold';
    return 'locked';
  }

  private withName(text: string, name: string) {
    return String(text || '').replace(/\{name\}/g, name);
  }

  private assertDate(localDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate || '')) {
      throw new BadRequestException('Fecha local inválida.');
    }
  }

  private fallbackDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
