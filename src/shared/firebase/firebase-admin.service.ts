import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (getApps().length) {
      this.app = getApps()[0]!;
      return;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const credentialsPath = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');

    if (!credentialsPath) {
      throw new Error(
        'Falta GOOGLE_APPLICATION_CREDENTIALS en el .env (ruta al Admin SDK JSON).',
      );
    }

    const absolutePath = resolve(process.cwd(), credentialsPath);
    if (!existsSync(absolutePath)) {
      throw new Error(
        `No se encuentra el archivo Firebase Admin SDK en: ${absolutePath}`,
      );
    }

    const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf8'));

    this.app = initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId ?? serviceAccount.project_id,
    });

    this.logger.log('Firebase Admin inicializado correctamente.');
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.app) {
      throw new Error('Firebase Admin no está inicializado.');
    }
    return getAuth(this.app).verifyIdToken(idToken);
  }

  /** Envía una notificación push real a un token FCM. */
  async sendPush(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    if (!this.app) {
      throw new Error('Firebase Admin no está inicializado.');
    }

    const message: Message = {
      token: params.token,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: params.data,
      webpush: {
        notification: {
          title: params.title,
          body: params.body,
        },
        fcmOptions: {
          link: '/',
        },
      },
    };

    const id = await getMessaging(this.app).send(message);
    this.logger.log(`Push enviada: ${id}`);
    return id;
  }

  /** Envía a varios tokens; limpia los inválidos. */
  async sendPushToTokens(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string> },
  ) {
    const results = { success: 0, failed: [] as string[] };
    for (const token of tokens) {
      try {
        await this.sendPush({ token, ...payload });
        results.success += 1;
      } catch (err: any) {
        this.logger.warn(`Fallo push token: ${err?.code || err?.message}`);
        results.failed.push(token);
      }
    }
    return results;
  }
}
