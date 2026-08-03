import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { FirebaseAdminService } from '../../shared/firebase/firebase-admin.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async registerToken(userId: string, token: string) {
    const user = await this.usersService.addFcmToken(userId, token);
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    // Verifica el token con un push real (si es inválido, no dejamos fcmTokens basura)
    try {
      await this.firebaseAdmin.sendPush({
        token,
        title: 'ACROBIT activado',
        body: 'Las notificaciones están listas. Tu disciplina empieza ahora.',
        data: { type: 'notifications_enabled' },
      });
    } catch (err: any) {
      const code = String(err?.code || '');
      this.logger.warn(`Push de activación falló: ${code || err?.message}`);
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        await this.usersService.removeFcmToken(userId, token);
        throw new BadRequestException(
          'Token FCM inválido. Recarga la app y vuelve a activar notificaciones.',
        );
      }
    }

    // T-10 pendiente del día (si tokens se habían perdido)
    try {
      await this.flushPendingT10Push(userId);
    } catch (err: any) {
      this.logger.warn(`No se pudo reenviar T-10 pendiente: ${err?.message}`);
    }

    const fresh = await this.usersService.findById(userId);
    return {
      ok: true,
      notificationsEnabled: true,
      tokensCount: fresh?.fcmTokens?.length ?? 0,
      pushQueued: true,
    };
  }

  async getStatus(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const di = user.dailyInteraction as
      | { kind?: string; stage?: string; pushSent?: boolean; goldenHour?: string; localDate?: string }
      | undefined;
    const tokensCount = Array.isArray(user.fcmTokens) ? user.fcmTokens.length : 0;
    return {
      notificationsEnabled: !!user.notificationsEnabled,
      tokensCount,
      pushReady: !!user.notificationsEnabled && tokensCount > 0,
      pendingT10:
        di?.kind === 't10' && di.stage !== 'done'
          ? {
              localDate: di.localDate || null,
              stage: di.stage || null,
              pushSent: !!di.pushSent,
              goldenHour: di.goldenHour || null,
            }
          : null,
    };
  }

  /** Reenvía pushes pendientes del día (T-10 y/o T-0) al recuperar el token. */
  private async flushPendingT10Push(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) return;
    const di = user.dailyInteraction as
      | {
          localDate?: string;
          kind?: string;
          stage?: string;
          promptText?: string;
          actions?: string[];
          pushSent?: boolean;
          startNotified?: boolean;
          startPushSent?: boolean;
          goldenHour?: string;
        }
      | undefined;
    if (!di || di.kind !== 't10' || di.stage === 'done') return;

    const base = {
      localDate: di.localDate,
      kind: 't10' as const,
      stage: di.stage || 'primary',
      promptText: di.promptText,
      actions: Array.isArray(di.actions) ? di.actions : ['si', 'no', 'reprogramar'],
      pushSent: !!di.pushSent,
      startNotified: !!di.startNotified,
      startPushSent: !!di.startPushSent,
      goldenHour: di.goldenHour,
    };

    if (!di.pushSent) {
      const result = await this.sendToUser(userId, {
        title: 'ACROBIT',
        body: `${di.promptText || 'Faltan 10 minutos para empezar tu hábito. Ánimo, hoy es el día.'} [Sí] [No] [Reprogramar]`,
        data: { type: 't10', localDate: String(di.localDate || '') },
      });
      if ((result?.sent ?? 0) > 0) {
        base.pushSent = true;
        await this.usersService.setDailyInteraction(userId, base);
        this.logger.log(`T-10 pendiente reenviado a user=${userId}`);
      }
    }

    if (di.startNotified && !di.startPushSent) {
      const result = await this.sendToUser(userId, {
        title: 'ACROBIT',
        body: 'Ya es tu Hora de Oro. Es el momento de empezar tu hábito. [Sí] [No] [Reprogramar]',
        data: { type: 't0', localDate: String(di.localDate || '') },
      });
      if ((result?.sent ?? 0) > 0) {
        await this.usersService.setDailyInteraction(userId, {
          ...base,
          startPushSent: true,
        });
        this.logger.log(`T-0 pendiente reenviado a user=${userId}`);
      }
    }
  }

  async disable(userId: string, token?: string) {
    if (token) {
      await this.usersService.removeFcmToken(userId, token);
    }
    await this.usersService.setNotificationsEnabled(userId, false);
    return { ok: true, notificationsEnabled: false };
  }

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (!user.notificationsEnabled) {
      throw new BadRequestException('El usuario tiene las notificaciones desactivadas.');
    }
    const tokens = user.fcmTokens ?? [];
    if (!tokens.length) {
      throw new BadRequestException('No hay tokens FCM registrados para este usuario.');
    }

    const result = await this.firebaseAdmin.sendPushToTokens(tokens, payload);
    if (result.failed.length) {
      await this.usersService.removeInvalidFcmTokens(userId, result.failed);
    }

    return {
      ok: true,
      sent: result.success,
      removedInvalid: result.failed.length,
    };
  }

  async sendTest(userId: string, title?: string, body?: string) {
    return this.sendToUser(userId, {
      title: title || 'ACROBIT',
      body: body || 'Esta es una notificación real de prueba.',
      data: { type: 'test' },
    });
  }
}
