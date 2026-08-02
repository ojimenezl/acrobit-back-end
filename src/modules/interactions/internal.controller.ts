import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { T10Scheduler } from './t10.scheduler';

/**
 * Disparo HTTP del T-10 (Vercel Cron / cron externo).
 * Nest @Cron no corre en serverless: hay que despertar la función cada minuto.
 */
@Controller('internal')
export class InternalController {
  constructor(
    private readonly t10: T10Scheduler,
    private readonly config: ConfigService,
  ) {}

  @Get('t10-tick')
  @HttpCode(HttpStatus.OK)
  tickGet(@Headers('authorization') authorization?: string) {
    return this.run(authorization);
  }

  @Post('t10-tick')
  @HttpCode(HttpStatus.OK)
  tickPost(@Headers('authorization') authorization?: string) {
    return this.run(authorization);
  }

  private async run(authorization?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      throw new UnauthorizedException('CRON_SECRET no configurado.');
    }
    if (authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException('No autorizado.');
    }
    const result = await this.t10.tick();
    return { ok: true, ...result };
  }
}
