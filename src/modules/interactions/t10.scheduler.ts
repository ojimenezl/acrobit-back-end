import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';
import { InteractionsService } from './interactions.service';
import { localStampInZone } from '../../shared/time/local-clock';

/**
 * Dispara el trillizo T-10 en el minuto exacto aunque la app esté cerrada.
 * Corre cada minuto y sincroniza usuarios con Hora de Oro definida.
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
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const users = await this.usersService.findUsersForT10Cron();
      for (const user of users) {
        const id = String(user._id);
        const zone = user.timeZone || 'Europe/Madrid';
        const { localDate, localTime } = localStampInZone(zone);
        try {
          await this.interactions.syncT10(id, localDate, localTime);
        } catch (err: any) {
          this.logger.warn(`T-10 sync falló user=${id}: ${err?.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Cron T-10: ${err?.message}`);
    } finally {
      this.running = false;
    }
  }
}
