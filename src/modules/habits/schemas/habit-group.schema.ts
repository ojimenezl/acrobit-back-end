import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HabitGroupDocument = HydratedDocument<HabitGroup>;

@Schema({ timestamps: true, collection: 'habit_groups' })
export class HabitGroup {
  /** Clave estable única (ej. muscle_gain, english_speaking). */
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  description: string;

  /**
   * Alcance estricto para la IA: solo puede hablar de este dominio.
   * Se inyecta en prompts futuros (chat, consejos, etc.).
   */
  @Prop({ required: true })
  scopePrompt: string;

  @Prop({ default: 0 })
  memberCount: number;
}

export const HabitGroupSchema = SchemaFactory.createForClass(HabitGroup);
