import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReflexionHoy, ReflexionHoyDocument } from './schemas/reflexion-hoy.schema';
import { UsersService } from '../users/users.service';
import { RoutineService } from '../routine/routine.service';
import { isValidTimeZone } from '../../shared/time/local-clock';

const SEED: Array<{ day: number; text: string }> = [
  {
    day: 1,
    text: 'La semilla no grita cuando crece. Solo necesita tierra y tiempo.',
  },
  {
    day: 2,
    text: 'El río no llega al mar de un salto. Cada curva es parte del camino.',
  },
  {
    day: 3,
    text: 'La montaña se sube con pasos pequeños. Hoy basta con uno.',
  },
];

const WEEKDAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const STATUS_CYCLE = ['ask', 'won', 'missed'] as const;
type TodayStatus = (typeof STATUS_CYCLE)[number];

@Injectable()
export class TodayService implements OnModuleInit {
  private readonly logger = new Logger(TodayService.name);

  constructor(
    @InjectModel(ReflexionHoy.name)
    private readonly reflexionModel: Model<ReflexionHoyDocument>,
    private readonly usersService: UsersService,
    private readonly routineService: RoutineService,
  ) {}

  async onModuleInit() {
    const count = await this.reflexionModel.countDocuments().exec();
    if (count > 0) return;
    await this.reflexionModel.insertMany(SEED);
    this.logger.log(`Seed reflexiones_hoy: ${SEED.length} entradas`);
  }

  async getToday(userId: string, localDate: string, timeZone?: string) {
    this.assertLocalDate(localDate);
    if (isValidTimeZone(timeZone)) {
      const current = await this.usersService.findById(userId);
      if (current && current.timeZone !== timeZone) {
        await this.usersService.updateTimeZone(userId, timeZone);
      }
    }
    const user = await this.requireUser(userId);
    const habitDay = Math.max(1, user.habitDay || 1);
    const reflection = await this.getReflectionForDay(habitDay);
    const status = this.resolveStatus(user.todayStatus, user.todayStatusOn, localDate);
    const canEditGoldenHour = user.goldenHourSetOn !== localDate;

    return {
      weekdayName: this.weekdayName(localDate),
      localDate,
      habitDay,
      reflection,
      goldenHour: user.goldenHour || null,
      canEditGoldenHour,
      todayStatus: status,
      statusLabel: this.statusLabel(status),
    };
  }

  async setGoldenHour(
    userId: string,
    time: string,
    localDate: string,
    adminBypass = false,
    timeZone?: string,
  ) {
    this.assertLocalDate(localDate);
    const normalized = this.normalizeTime(time);
    const user = await this.requireUser(userId);

    if (!adminBypass && user.goldenHourSetOn === localDate) {
      throw new BadRequestException(
        'La Hora de Oro solo se puede editar una vez al día.',
      );
    }

    if (isValidTimeZone(timeZone)) {
      await this.usersService.updateTimeZone(userId, timeZone);
    }
    await this.usersService.updateGoldenHour(userId, normalized, localDate);
    return this.getToday(userId, localDate, timeZone);
  }

  async cycleStatus(userId: string, localDate: string) {
    this.assertLocalDate(localDate);
    const user = await this.requireUser(userId);
    const current = this.resolveStatus(user.todayStatus, user.todayStatusOn, localDate);
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

    await this.usersService.updateTodayStatus(userId, next, localDate);
    await this.routineService.syncDayStatus(userId, localDate, next);
    const data = await this.getToday(userId, localDate);
    return {
      ...data,
      confetti: next === 'won',
    };
  }

  private async getReflectionForDay(habitDay: number): Promise<string> {
    const day = Math.max(1, habitDay || 1);
    const exact = await this.reflexionModel.findOne({ day }).lean().exec();
    if (exact?.text) return exact.text;

    const total = await this.reflexionModel.countDocuments().exec();
    if (!total) return 'La paciencia también es una forma de avanzar.';

    const cycleDay = ((day - 1) % total) + 1;
    const cycled = await this.reflexionModel.findOne({ day: cycleDay }).lean().exec();
    return cycled?.text || 'La paciencia también es una forma de avanzar.';
  }

  private resolveStatus(
    status: TodayStatus | undefined,
    statusOn: string | undefined,
    localDate: string,
  ): TodayStatus {
    if (statusOn !== localDate) return 'ask';
    if (status === 'won' || status === 'missed' || status === 'ask') return status;
    return 'ask';
  }

  private statusLabel(status: TodayStatus) {
    if (status === 'won') return '¡Lo logré!';
    if (status === 'missed') return 'No salió hoy';
    return '¿Cómo te fue?';
  }

  private weekdayName(localDate: string) {
    const [y, m, d] = localDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return WEEKDAYS[date.getDay()] || 'Hoy';
  }

  private normalizeTime(raw: string) {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(raw || '').trim());
    if (!match) {
      throw new BadRequestException('Usa una hora válida (ej. 18:00).');
    }
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  private assertLocalDate(localDate: string) {
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
