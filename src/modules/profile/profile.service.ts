import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RoutineService } from '../routine/routine.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly usersService: UsersService,
    private readonly routineService: RoutineService,
  ) {}

  async getProfile(userId: string, localDate: string) {
    this.assertLocalDate(localDate);
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    if (!user.onboardingCompleted) {
      throw new BadRequestException('Completa el onboarding primero.');
    }

    const habitDay = await this.syncHabitDay(userId, user, localDate);
    const week = await this.routineService.getWeek(userId, localDate);

    const elapsedDays = week.days.filter((d) => d.date <= localDate).length;
    const wonDays = week.days.filter(
      (d) => d.date <= localDate && d.state === 'won',
    ).length;

    const todayCard = week.days.find((d) => d.isToday);
    const todayDone = todayCard?.state === 'won' ? 1 : 0;
    const isRestDay = todayCard?.state === 'rest';

    const constancy =
      elapsedDays > 0 ? Math.round((wonDays / elapsedDays) * 100) : 0;

    return {
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        identityTitle: user.identityTitle || null,
        identityRole: user.identityRole || null,
        identityTagline: user.identityTagline || null,
        habitRaw: user.habitRaw || null,
        habitGroupName: user.habitGroupName || null,
        goldenHour: user.goldenHour || null,
        motivatorObject: user.motivatorObject || null,
        notificationsEnabled: !!user.notificationsEnabled,
      },
      stats: {
        today: {
          done: isRestDay ? 1 : todayDone,
          total: 1,
          label: isRestDay ? 'Descanso' : 'Hoy',
          rest: isRestDay,
        },
        week: {
          done: wonDays,
          total: Math.max(1, elapsedDays),
          label: 'Semana',
        },
        journeyDay: {
          value: habitDay,
          label: 'Día de viaje',
        },
        constancy: {
          value: constancy,
          label: 'Constancia',
        },
      },
    };
  }

  async resetJourney(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    await this.usersService.resetJourney(userId);
    return { ok: true, onboardingCompleted: false };
  }

  private async syncHabitDay(userId: string, user: any, localDate: string) {
    let started = user.habitStartedOn as string | undefined;
    if (!started || !/^\d{4}-\d{2}-\d{2}$/.test(started)) {
      // Usuarios antiguos: anclar el día actual como referencia
      const current = Math.max(1, user.habitDay || 1);
      started = this.addDays(localDate, -(current - 1));
      await this.usersService.updateHabitProgress(userId, {
        habitStartedOn: started,
        habitDay: current,
      });
      return current;
    }

    const day = Math.max(1, this.diffDays(started, localDate) + 1);
    if (day !== user.habitDay) {
      await this.usersService.updateHabitProgress(userId, { habitDay: day });
    }
    return day;
  }

  private diffDays(from: string, to: string) {
    const a = this.parseDate(from);
    const b = this.parseDate(to);
    return Math.floor((b.getTime() - a.getTime()) / 86400000);
  }

  private addDays(localDate: string, delta: number) {
    const d = this.parseDate(localDate);
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseDate(localDate: string) {
    const [y, m, d] = localDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private assertLocalDate(localDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate || '')) {
      throw new BadRequestException('Fecha local inválida.');
    }
  }
}
