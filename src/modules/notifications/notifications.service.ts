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

    // Push de confirmación en segundo plano (no bloquea la respuesta)
    void this.firebaseAdmin
      .sendPush({
        token,
        title: 'ACROBIT activado',
        body: 'Las notificaciones están listas. Tu disciplina empieza ahora.',
        data: { type: 'notifications_enabled' },
      })
      .catch((err: any) => {
        this.logger.warn(`No se pudo enviar push de bienvenida: ${err?.message}`);
      });

    return {
      ok: true,
      notificationsEnabled: true,
      tokensCount: user.fcmTokens?.length ?? 0,
      pushQueued: true,
    };
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
