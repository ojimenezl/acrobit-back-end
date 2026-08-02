import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Schema({ _id: true })
export class ChatMessage {
  @Prop({ required: true, enum: ['assistant', 'user'] })
  role: 'assistant' | 'user';

  @Prop({ required: true })
  text: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: false, select: false })
  password?: string;

  @Prop({
    type: String,
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  provider: AuthProvider;

  @Prop({ required: false, index: true })
  firebaseUid?: string;

  @Prop({ default: false })
  onboardingCompleted: boolean;

  @Prop({ default: false })
  termsAccepted: boolean;

  @Prop({ default: false })
  notificationsEnabled: boolean;

  @Prop({ required: false, trim: true })
  habitRaw?: string;

  @Prop({ type: Types.ObjectId, ref: 'HabitGroup', required: false, index: true })
  habitGroupId?: Types.ObjectId;

  @Prop({ required: false, index: true })
  habitGroupKey?: string;

  @Prop({ required: false })
  habitGroupName?: string;

  @Prop({ required: false })
  identityTitle?: string;

  @Prop({ required: false })
  identityRole?: string;

  @Prop({ required: false })
  identityTagline?: string;

  /** Día actual del hábito (empieza en 1). */
  @Prop({ default: 1 })
  habitDay: number;

  /** Fecha local YYYY-MM-DD en que empezó el hábito (día 1). */
  @Prop({ required: false })
  habitStartedOn?: string;

  /** Hora de Oro del usuario, formato HH:mm (ej. 18:00). */
  @Prop({ required: false })
  goldenHour?: string;

  /** Fecha local YYYY-MM-DD en la que se fijó/editó la Hora de Oro. */
  @Prop({ required: false })
  goldenHourSetOn?: string;

  /** Zona IANA del usuario (para cron T-10), ej. Europe/Madrid. */
  @Prop({ required: false })
  timeZone?: string;

  /** Estado del día: ask → won → missed → ask. */
  @Prop({
    type: String,
    enum: ['ask', 'won', 'missed'],
    default: 'ask',
  })
  todayStatus: 'ask' | 'won' | 'missed';

  /** Fecha local YYYY-MM-DD del estado actual. */
  @Prop({ required: false })
  todayStatusOn?: string;

  /**
   * Rutina de la semana actual (sin historial).
   * days[0..6] = Dom→Sáb: 0 aún no / en curso, 1 logrado, 2 no logrado.
   * Al cambiar de semana (nuevo domingo) se reinicia a ceros.
   */
  @Prop({
    type: {
      weekStart: { type: String, required: true },
      days: { type: [Number], default: [0, 0, 0, 0, 0, 0, 0] },
    },
    required: false,
  })
  rutina?: {
    weekStart: string;
    days: number[];
  };

  /**
   * Objeto motivador de paciencia (elección única).
   * gem | sword | bonsai | diamond
   */
  @Prop({
    required: false,
    enum: ['gem', 'sword', 'bonsai', 'diamond'],
  })
  motivatorObject?: 'gem' | 'sword' | 'bonsai' | 'diamond';

  /**
   * Progreso Logro (por usuario). Solo avanza con “Lo logré”.
   * logroDaysWithoutAdvance: oculto en UI; solo BD.
   */
  @Prop({ default: 1, min: 1 })
  logroDay: number;

  @Prop({ type: [Number], default: [] })
  logroWonDays: number[];

  @Prop({ default: 0, min: 0 })
  logroDaysWithoutAdvance: number;

  /** Última fecha local YYYY-MM-DD en la que avanzó (Lo logré). */
  @Prop({ required: false })
  logroLastAdvanceOn?: string;

  /** Última fecha local contada como “sin avanzar”. */
  @Prop({ required: false })
  logroStagnationOn?: string;

  /** Última fecha local vista por el motor de Logro. */
  @Prop({ required: false })
  logroCalendarOn?: string;

  @Prop({ type: [String], default: [] })
  fcmTokens: string[];

  @Prop({ required: false })
  welcomeMessage?: string;

  @Prop({ default: false })
  welcomeCompleted: boolean;

  /** Historial del chat (estilo WhatsApp). */
  @Prop({ type: [ChatMessageSchema], default: [] })
  chatMessages: ChatMessage[];

  /**
   * Feed de la página Notificaciones (mismo texto que el chat en el flujo diario).
   */
  @Prop({ type: [ChatMessageSchema], default: [] })
  notificationFeed: ChatMessage[];

  /**
   * Interacción diaria T-10 (trillizos: chat + notifs + push).
   * stage: primary → after_no → done
   */
  @Prop({
    type: {
      localDate: { type: String },
      kind: { type: String },
      stage: { type: String },
      promptText: { type: String },
      actions: { type: [String], default: [] },
      pushSent: { type: Boolean, default: false },
    },
    required: false,
  })
  dailyInteraction?: {
    localDate: string;
    kind: 't10';
    stage: 'primary' | 'after_no' | 'done';
    promptText: string;
    actions: string[];
    pushSent: boolean;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
