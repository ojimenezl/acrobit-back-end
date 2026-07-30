import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

/** 0 = aún no / en curso, 1 = logrado, 2 = no logrado */
export type RutinaCode = 0 | 1 | 2;
export type WeekDayState = 'won' | 'missed' | 'upcoming' | 'pending' | 'rest';

@Injectable()
export class RoutineService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Sincroniza el estado de Hoy con user.rutina (semana actual, sin historial).
   * 1 = logrado, 2 = no logrado, 0 = sin decisión.
   */
  async syncDayStatus(
    userId: string,
    localDate: string,
    status: 'ask' | 'won' | 'missed',
  ) {
    this.assertLocalDate(localDate);
    const weekday = this.weekdayIndex(localDate);
    if (weekday === 6) return; // sábado: descanso, no se registra

    const { days, weekStart } = await this.ensureCurrentWeek(userId, localDate);
    const code: RutinaCode = status === 'won' ? 1 : status === 'missed' ? 2 : 0;
    days[weekday] = code;
    await this.usersService.setRutina(userId, { weekStart, days });
  }

  async getWeek(userId: string, localDate: string) {
    this.assertLocalDate(localDate);
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    if (!user.onboardingCompleted) {
      throw new BadRequestException('Completa el onboarding primero.');
    }

    const { days, weekStart, dates } = await this.ensureCurrentWeek(userId, localDate);

    // Días pasados aún en 0 → se marcan como 2 (sin historial entre semanas)
    let dirty = false;
    for (let i = 0; i < 6; i++) {
      if (dates[i] < localDate && days[i] === 0) {
        days[i] = 2;
        dirty = true;
      }
    }
    if (dirty) {
      await this.usersService.setRutina(userId, { weekStart, days });
    }

    const todayStatus =
      user.todayStatusOn === localDate
        ? (user.todayStatus as 'ask' | 'won' | 'missed')
        : 'ask';

    // Alinear hoy con todayStatus si hace falta
    const todayIdx = this.weekdayIndex(localDate);
    if (todayIdx < 6) {
      const expected: RutinaCode =
        todayStatus === 'won' ? 1 : todayStatus === 'missed' ? 2 : 0;
      if (days[todayIdx] !== expected) {
        days[todayIdx] = expected;
        await this.usersService.setRutina(userId, { weekStart, days });
      }
    }

    const cards = dates.map((date, weekday) => {
      const state = this.resolveState(date, localDate, weekday, days[weekday] as RutinaCode);
      return {
        date,
        weekday,
        name: DAY_NAMES[weekday],
        shortName: DAY_NAMES[weekday].slice(0, 3),
        code: weekday === 6 ? 0 : days[weekday],
        state,
        label: this.stateLabel(state),
        goldenHour: user.goldenHour || null,
        isToday: date === localDate,
      };
    });

    return {
      localDate,
      weekStart,
      weekEnd: dates[6],
      goldenHour: user.goldenHour || null,
      days: cards,
    };
  }

  /** Garantiza rutina de la semana Dom–Sáb; reinicia a ceros si cambió el domingo. */
  private async ensureCurrentWeek(userId: string, localDate: string) {
    const dates = this.weekDatesFrom(localDate);
    const weekStart = dates[0];
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');

    const current = user.rutina;
    if (current?.weekStart === weekStart && Array.isArray(current.days) && current.days.length === 7) {
      return {
        weekStart,
        dates,
        days: current.days.map((n) => (n === 1 || n === 2 ? n : 0)),
      };
    }

    const days = [0, 0, 0, 0, 0, 0, 0];
    await this.usersService.setRutina(userId, { weekStart, days });
    return { weekStart, dates, days };
  }

  private resolveState(
    date: string,
    today: string,
    weekday: number,
    code: RutinaCode,
  ): WeekDayState {
    if (weekday === 6) return 'rest';
    if (date > today) return 'upcoming';
    if (date === today) {
      if (code === 1) return 'won';
      if (code === 2) return 'missed';
      return 'pending';
    }
    if (code === 1) return 'won';
    return 'missed';
  }

  private stateLabel(state: WeekDayState) {
    if (state === 'rest') return 'Día de descanso';
    if (state === 'won') return 'Logrado';
    if (state === 'missed') return 'Sigue adelante';
    if (state === 'upcoming') return 'En espera';
    return 'En curso';
  }

  private weekDatesFrom(localDate: string) {
    const [y, m, d] = localDate.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const sunday = new Date(base);
    sunday.setDate(base.getDate() - base.getDay());

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(sunday);
      cur.setDate(sunday.getDate() + i);
      dates.push(this.formatDate(cur));
    }
    return dates;
  }

  private weekdayIndex(localDate: string) {
    const [y, m, d] = localDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  }

  private formatDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private assertLocalDate(localDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate || '')) {
      throw new BadRequestException('Fecha local inválida.');
    }
  }
}
