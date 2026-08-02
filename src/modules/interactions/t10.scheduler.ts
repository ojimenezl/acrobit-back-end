import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';
import { InteractionsService } from './interactions.service';
import { localStampInZone } from '../../shared/time/local-clock';

/**
 * Dispara el trillizo T-10 en el minuto exacto aunque la app esté cerrada.
 * - Local (`nest start`): @Cron cada minuto.
 * - Vercel serverless: el @Cron no corre; usar GET/POST /api/internal/t10-tick.
 */
@Injectable()
export class T10Scheduler {
  private readonly logger = new Logger(T10Scheduler.name);
  private running = false;

  constructor(
    private readonly usersService: UsersService,
    private readonly interactions: InteractionsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async onCron() {
    await this.tick();
  }

  /** Ejecutable desde cron Nest o desde el endpoint HTTP. */
  async tick(): Promise<{ checked: number; errors: number }> {
    if (this.running) {
      return { checked: 0, errors: 0 };
    }
    this.running = true;
    let checked = 0;
    let errors = 0;
    try {
      const users = await this.usersService.findUsersForT10Cron();
      for (const user of users) {
        checked += 1;
        const id = String(user._id);
        const zone = user.timeZone || 'Europe/Madrid';
        const { localDate, localTime } = localStampInZone(zone);
        try {
          await this.interactions.syncT10(id, localDate, localTime);
        } catch (err: any) {
          errors += 1;
          this.logger.warn(`T-10 sync falló user=${id}: ${err?.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Cron T-10: ${err?.message}`);
      errors += 1;
    } finally {
      this.running = false;
    }
    return { checked, errors };
  }
}
