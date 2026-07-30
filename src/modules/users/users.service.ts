import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, AuthProvider } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Busca por email. Incluye el hash de la contraseña (para validar login). */
  findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  findByFirebaseUid(firebaseUid: string) {
    return this.userModel.findOne({ firebaseUid }).exec();
  }

  create(data: {
    name: string;
    email: string;
    password?: string;
    provider?: AuthProvider;
    firebaseUid?: string;
  }) {
    return this.userModel.create({
      ...data,
      email: data.email.toLowerCase().trim(),
      provider: data.provider ?? AuthProvider.LOCAL,
    });
  }

  /** Vincula una cuenta local existente con un UID de Firebase. */
  async linkFirebaseUid(userId: string, firebaseUid: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { firebaseUid, provider: AuthProvider.GOOGLE },
        { new: true },
      )
      .exec();
  }

  async completeOnboarding(
    userId: string,
    data: {
      termsAccepted: boolean;
      notificationsEnabled: boolean;
      habitRaw: string;
      habitGroupId: string;
      habitGroupKey: string;
      habitGroupName: string;
      identityTitle: string;
      identityRole: string;
      identityTagline: string;
    },
  ) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          termsAccepted: data.termsAccepted,
          notificationsEnabled: data.notificationsEnabled,
          habitRaw: data.habitRaw,
          habitGroupId: data.habitGroupId,
          habitGroupKey: data.habitGroupKey,
          habitGroupName: data.habitGroupName,
          identityTitle: data.identityTitle,
          identityRole: data.identityRole,
          identityTagline: data.identityTagline,
          onboardingCompleted: true,
          habitDay: 1,
          habitStartedOn: new Date().toISOString().slice(0, 10),
          todayStatus: 'ask',
        },
        { new: true },
      )
      .exec();
  }

  async updateGoldenHour(userId: string, goldenHour: string, localDate: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { goldenHour, goldenHourSetOn: localDate },
        { new: true },
      )
      .exec();
  }

  async updateTimeZone(userId: string, timeZone: string) {
    return this.userModel
      .findByIdAndUpdate(userId, { timeZone }, { new: true })
      .exec();
  }

  /** Usuarios listos para el cron T-10 (Hora de Oro + bienvenida). */
  findUsersForT10Cron() {
    return this.userModel
      .find({
        onboardingCompleted: true,
        welcomeCompleted: true,
        goldenHour: { $exists: true, $nin: [null, ''] },
      })
      .select('_id goldenHour timeZone dailyInteraction notificationsEnabled fcmTokens')
      .lean()
      .exec();
  }

  async updateTodayStatus(
    userId: string,
    todayStatus: 'ask' | 'won' | 'missed',
    localDate: string,
  ) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { todayStatus, todayStatusOn: localDate },
        { new: true },
      )
      .exec();
  }

  async setRutina(
    userId: string,
    rutina: { weekStart: string; days: number[] },
  ) {
    return this.userModel
      .findByIdAndUpdate(userId, { rutina }, { new: true })
      .exec();
  }

  async setMotivatorObject(
    userId: string,
    motivatorObject: 'gem' | 'sword' | 'bonsai' | 'diamond',
  ) {
    return this.userModel
      .findByIdAndUpdate(userId, { motivatorObject }, { new: true })
      .exec();
  }

  async updateHabitProgress(
    userId: string,
    data: { habitDay: number; habitStartedOn?: string },
  ) {
    return this.userModel.findByIdAndUpdate(userId, data, { new: true }).exec();
  }

  /** Reinicia el viaje: vuelve al onboarding (mantiene cuenta). */
  async resetJourney(userId: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          onboardingCompleted: false,
          termsAccepted: false,
          habitRaw: null,
          habitGroupId: null,
          habitGroupKey: null,
          habitGroupName: null,
          identityTitle: null,
          identityRole: null,
          identityTagline: null,
          habitDay: 1,
          habitStartedOn: null,
          goldenHour: null,
          goldenHourSetOn: null,
          todayStatus: 'ask',
          todayStatusOn: null,
          rutina: null,
          motivatorObject: null,
          welcomeMessage: null,
          welcomeCompleted: false,
          chatMessages: [],
          notificationFeed: [],
          dailyInteraction: null,
        },
        { new: true },
      )
      .exec();
  }

  async setHabitGroupLabels(
    userId: string,
    data: { habitGroupId: string; habitGroupKey: string; habitGroupName: string },
  ) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          habitGroupId: data.habitGroupId,
          habitGroupKey: data.habitGroupKey,
          habitGroupName: data.habitGroupName,
        },
        { new: true },
      )
      .exec();
  }

  async addFcmToken(userId: string, token: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $addToSet: { fcmTokens: token },
          notificationsEnabled: true,
        },
        { new: true },
      )
      .exec();
  }

  async removeFcmToken(userId: string, token: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { fcmTokens: token } },
        { new: true },
      )
      .exec();
  }

  async removeInvalidFcmTokens(userId: string, tokens: string[]) {
    if (!tokens.length) return null;
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { fcmTokens: { $in: tokens } } },
        { new: true },
      )
      .exec();
  }

  async setNotificationsEnabled(userId: string, enabled: boolean) {
    const update: Record<string, unknown> = { notificationsEnabled: enabled };
    if (!enabled) {
      update.fcmTokens = [];
    }
    return this.userModel.findByIdAndUpdate(userId, update, { new: true }).exec();
  }

  async saveWelcomeMessage(userId: string, welcomeMessage: string) {
    return this.userModel
      .findByIdAndUpdate(userId, { welcomeMessage }, { new: true })
      .exec();
  }

  async markWelcomeCompleted(userId: string) {
    return this.userModel
      .findByIdAndUpdate(userId, { welcomeCompleted: true }, { new: true })
      .exec();
  }

  async setChatMessages(
    userId: string,
    messages: Array<{ role: 'assistant' | 'user'; text: string; createdAt?: Date }>,
  ) {
    return this.userModel
      .findByIdAndUpdate(userId, { chatMessages: messages }, { new: true })
      .exec();
  }

  async appendChatMessages(
    userId: string,
    messages: Array<{ role: 'assistant' | 'user'; text: string; createdAt?: Date }>,
  ) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $push: { chatMessages: { $each: messages } } },
        { new: true },
      )
      .exec();
  }

  /** Borra el chat y reinicia la bienvenida (vuelve a mostrar Gracias). */
  async clearChat(userId: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          chatMessages: [],
          welcomeMessage: null,
          welcomeCompleted: false,
          notificationFeed: [],
          dailyInteraction: null,
        },
        { new: true },
      )
      .exec();
  }

  async setDailyInteraction(userId: string, dailyInteraction: any) {
    return this.userModel
      .findByIdAndUpdate(userId, { dailyInteraction }, { new: true })
      .exec();
  }

  async appendNotificationFeed(
    userId: string,
    messages: Array<{ role: 'assistant' | 'user'; text: string; createdAt?: Date }>,
  ) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $push: { notificationFeed: { $each: messages } } },
        { new: true },
      )
      .exec();
  }

  async appendTripletMessages(
    userId: string,
    messages: Array<{ role: 'assistant' | 'user'; text: string; createdAt?: Date }>,
  ) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $push: {
            chatMessages: { $each: messages },
            notificationFeed: { $each: messages },
          },
        },
        { new: true },
      )
      .exec();
  }
}
