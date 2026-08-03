/**
 * Suite de protección del flujo de notificaciones T-10 / FCM.
 * Debe pasar en cada build (`npm run test:notifications`).
 */
import { BadRequestException } from '@nestjs/common';
import { InteractionsService } from '../src/modules/interactions/interactions.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { FirebaseAdminService } from '../src/shared/firebase/firebase-admin.service';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'u1',
    onboardingCompleted: true,
    welcomeCompleted: true,
    goldenHour: '18:00',
    timeZone: 'Europe/Madrid',
    notificationsEnabled: true,
    fcmTokens: ['token-abc'],
    dailyInteraction: null as any,
    notificationFeed: [],
    ...overrides,
  };
}

describe('Notifications / T-10 protection suite', () => {
  describe('InteractionsService.syncT10', () => {
    let users: any;
    let notifications: any;
    let service: InteractionsService;

    beforeEach(() => {
      users = {
        findById: jest.fn(),
        setDailyInteraction: jest.fn().mockResolvedValue(undefined),
        appendTripletMessages: jest.fn().mockResolvedValue(undefined),
        clearTodayT10Interaction: jest.fn().mockResolvedValue(undefined),
        updateGoldenHour: jest.fn().mockResolvedValue(undefined),
        updateTimeZone: jest.fn().mockResolvedValue(undefined),
      };
      notifications = {
        sendToUser: jest.fn().mockResolvedValue({ ok: true, sent: 1, removedInvalid: 0 }),
      };
      service = new InteractionsService(users, notifications);
    });

    it('crea T-10 y envía push cuando ya pasó la ventana (−10 min)', async () => {
      const user = makeUser();
      users.findById.mockResolvedValue(user);

      await service.syncT10('u1', '2026-08-03', '17:50');

      expect(users.appendTripletMessages).toHaveBeenCalledTimes(1);
      expect(users.setDailyInteraction).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          kind: 't10',
          stage: 'primary',
          pushSent: false,
          goldenHour: '18:00',
        }),
      );
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          data: expect.objectContaining({ type: 't10' }),
        }),
      );
      // Tras push ok marca pushSent
      expect(users.setDailyInteraction).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ pushSent: true }),
      );
    });

    it('NO crea T-10 si aún es demasiado pronto', async () => {
      users.findById.mockResolvedValue(makeUser());
      await service.syncT10('u1', '2026-08-03', '17:40');
      expect(users.appendTripletMessages).not.toHaveBeenCalled();
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('NO duplica T-10 el mismo día / misma hora', async () => {
      const user = makeUser({
        dailyInteraction: {
          localDate: '2026-08-03',
          kind: 't10',
          stage: 'primary',
          promptText: 'Faltan 10 minutos…',
          actions: ['si', 'no', 'reprogramar'],
          pushSent: true,
          goldenHour: '18:00',
        },
      });
      users.findById.mockResolvedValue(user);

      await service.syncT10('u1', '2026-08-03', '17:55');

      expect(users.appendTripletMessages).not.toHaveBeenCalled();
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('al reprogramar limpia el T-10 para poder avisar otra vez', async () => {
      const user = makeUser({
        dailyInteraction: {
          localDate: '2026-08-03',
          kind: 't10',
          stage: 'primary',
          promptText: 'x',
          actions: ['si', 'no', 'reprogramar'],
          pushSent: true,
          goldenHour: '18:00',
        },
      });
      users.findById.mockResolvedValue(user);

      await service.handleAction('u1', 'reprogramar', '2026-08-03', {
        newGoldenHour: '20:00',
      });

      expect(users.updateGoldenHour).toHaveBeenCalledWith('u1', '20:00', '2026-08-03');
      expect(users.clearTodayT10Interaction).toHaveBeenCalledWith('u1', '2026-08-03');
    });

    it('si cambió la Hora de Oro, permite un T-10 nuevo', async () => {
      const user = makeUser({
        goldenHour: '20:00',
        dailyInteraction: {
          localDate: '2026-08-03',
          kind: 't10',
          stage: 'done',
          promptText: 'x',
          actions: [],
          pushSent: true,
          goldenHour: '18:00',
        },
      });
      users.findById.mockResolvedValue(user);

      await service.syncT10('u1', '2026-08-03', '19:50');

      expect(users.clearTodayT10Interaction).toHaveBeenCalled();
      expect(users.appendTripletMessages).toHaveBeenCalled();
      expect(notifications.sendToUser).toHaveBeenCalled();
    });

    it('reintenta push si el T-10 existe pero pushSent=false y hay tokens', async () => {
      const user = makeUser({
        dailyInteraction: {
          localDate: '2026-08-03',
          kind: 't10',
          stage: 'primary',
          promptText: 'Faltan 10 minutos para empezar tu hábito. Ánimo, hoy es el día.',
          actions: ['si', 'no', 'reprogramar'],
          pushSent: false,
          goldenHour: '18:00',
        },
      });
      users.findById.mockResolvedValue(user);

      await service.syncT10('u1', '2026-08-03', '17:55');

      expect(users.appendTripletMessages).not.toHaveBeenCalled();
      expect(notifications.sendToUser).toHaveBeenCalledTimes(1);
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ data: expect.objectContaining({ type: 't10' }) }),
      );
    });

    it('T-0: al llegar la Hora de Oro envía push con el mismo sendToUser (type t0)', async () => {
      const user = makeUser({
        dailyInteraction: {
          localDate: '2026-08-03',
          kind: 't10',
          stage: 'primary',
          promptText: 'Faltan 10 minutos…',
          actions: ['si', 'no', 'reprogramar'],
          pushSent: true,
          startNotified: false,
          startPushSent: false,
          goldenHour: '18:00',
        },
      });
      users.findById.mockResolvedValue(user);

      await service.syncT10('u1', '2026-08-03', '18:00');

      expect(users.appendTripletMessages).toHaveBeenCalledWith(
        'u1',
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('Ya es tu Hora de Oro'),
          }),
        ]),
      );
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          data: expect.objectContaining({ type: 't0' }),
        }),
      );
      expect(users.setDailyInteraction).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ startPushSent: true }),
      );
    });

    it('T-0: NO avisa antes de la Hora de Oro', async () => {
      const user = makeUser({
        dailyInteraction: {
          localDate: '2026-08-03',
          kind: 't10',
          stage: 'primary',
          promptText: 'Faltan 10 minutos…',
          actions: ['si', 'no', 'reprogramar'],
          pushSent: true,
          startNotified: false,
          startPushSent: false,
          goldenHour: '18:00',
        },
      });
      users.findById.mockResolvedValue(user);

      await service.syncT10('u1', '2026-08-03', '17:59');

      expect(users.appendTripletMessages).not.toHaveBeenCalled();
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('T-0: NO duplica si startPushSent ya es true', async () => {
      const user = makeUser({
        dailyInteraction: {
          localDate: '2026-08-03',
          kind: 't10',
          stage: 'primary',
          promptText: 'Ya es tu Hora de Oro…',
          actions: ['si', 'no', 'reprogramar'],
          pushSent: true,
          startNotified: true,
          startPushSent: true,
          goldenHour: '18:00',
        },
      });
      users.findById.mockResolvedValue(user);

      await service.syncT10('u1', '2026-08-03', '18:05');

      expect(users.appendTripletMessages).not.toHaveBeenCalled();
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('T-0: NO avisa si el ciclo ya está done (respondió Sí/No)', async () => {
      const user = makeUser({
        dailyInteraction: {
          localDate: '2026-08-03',
          kind: 't10',
          stage: 'done',
          promptText: 'x',
          actions: [],
          pushSent: true,
          startNotified: false,
          startPushSent: false,
          goldenHour: '18:00',
        },
      });
      users.findById.mockResolvedValue(user);

      await service.syncT10('u1', '2026-08-03', '18:00');

      expect(users.appendTripletMessages).not.toHaveBeenCalled();
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('NotificationsService.registerToken + status', () => {
    let users: any;
    let firebase: any;
    let service: NotificationsService;

    beforeEach(() => {
      users = {
        addFcmToken: jest.fn(),
        findById: jest.fn(),
        removeFcmToken: jest.fn(),
        setDailyInteraction: jest.fn(),
        removeInvalidFcmTokens: jest.fn(),
        setNotificationsEnabled: jest.fn(),
      };
      firebase = {
        sendPush: jest.fn().mockResolvedValue('msg-1'),
        sendPushToTokens: jest.fn().mockResolvedValue({ success: 1, failed: [] }),
      };
      service = new NotificationsService(users, firebase as FirebaseAdminService);
    });

    it('guarda token, verifica con push y reporta tokensCount', async () => {
      users.addFcmToken.mockResolvedValue(
        makeUser({ fcmTokens: ['tok-1'] }),
      );
      users.findById.mockResolvedValue(makeUser({ fcmTokens: ['tok-1'] }));

      const res = await service.registerToken('u1', 'tok-1-long-enough-token');

      expect(firebase.sendPush).toHaveBeenCalled();
      expect(res.tokensCount).toBe(1);
      expect(res.notificationsEnabled).toBe(true);
    });

    it('si el token es inválido, lo borra y lanza error', async () => {
      users.addFcmToken.mockResolvedValue(makeUser({ fcmTokens: ['bad'] }));
      firebase.sendPush.mockRejectedValue({
        code: 'messaging/registration-token-not-registered',
        message: 'bad token',
      });

      await expect(
        service.registerToken('u1', 'bad-token-long-enough'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.removeFcmToken).toHaveBeenCalledWith('u1', 'bad-token-long-enough');
    });

    it('reenvía T-10 pendiente al registrar token', async () => {
      users.addFcmToken.mockResolvedValue(makeUser({ fcmTokens: ['tok-1'] }));
      users.findById.mockResolvedValue(
        makeUser({
          fcmTokens: ['tok-1'],
          dailyInteraction: {
            localDate: '2026-08-03',
            kind: 't10',
            stage: 'primary',
            promptText: 'Faltan 10 minutos…',
            actions: ['si', 'no', 'reprogramar'],
            pushSent: false,
            goldenHour: '18:00',
          },
        }),
      );

      await service.registerToken('u1', 'tok-1-long-enough-token');

      expect(firebase.sendPushToTokens).toHaveBeenCalled();
      expect(users.setDailyInteraction).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ pushSent: true }),
      );
    });

    it('getStatus indica pushReady solo con tokens', async () => {
      users.findById.mockResolvedValue(
        makeUser({ notificationsEnabled: true, fcmTokens: [] }),
      );
      const bad = await service.getStatus('u1');
      expect(bad.pushReady).toBe(false);
      expect(bad.tokensCount).toBe(0);

      users.findById.mockResolvedValue(
        makeUser({ notificationsEnabled: true, fcmTokens: ['a'] }),
      );
      const ok = await service.getStatus('u1');
      expect(ok.pushReady).toBe(true);
      expect(ok.tokensCount).toBe(1);
    });

    it('sendToUser falla claro sin tokens', async () => {
      users.findById.mockResolvedValue(
        makeUser({ notificationsEnabled: true, fcmTokens: [] }),
      );
      await expect(
        service.sendToUser('u1', { title: 't', body: 'b' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('FirebaseAdminService.sendPushToTokens', () => {
    it('solo marca failed tokens con códigos permanentes', async () => {
      const svc = Object.create(FirebaseAdminService.prototype) as FirebaseAdminService;
      (svc as any).logger = { warn: jest.fn(), log: jest.fn() };
      (svc as any).app = {};
      jest.spyOn(svc, 'sendPush').mockImplementation(async ({ token }) => {
        if (token === 'dead') {
          const err: any = new Error('dead');
          err.code = 'messaging/registration-token-not-registered';
          throw err;
        }
        if (token === 'temp') {
          const err: any = new Error('quota');
          err.code = 'messaging/server-unavailable';
          throw err;
        }
        return 'ok';
      });

      const res = await svc.sendPushToTokens(
        ['ok', 'dead', 'temp'],
        { title: 't', body: 'b' },
      );

      expect(res.success).toBe(1);
      expect(res.failed).toEqual(['dead']);
    });
  });
});
