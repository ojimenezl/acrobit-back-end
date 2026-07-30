import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReflexionHoyDocument = HydratedDocument<ReflexionHoy>;

@Schema({ timestamps: true, collection: 'reflexiones_hoy' })
export class ReflexionHoy {
  /** Día del hábito al que corresponde (1, 2, 3…). */
  @Prop({ required: true, unique: true, index: true, min: 1 })
  day: number;

  /** Metáfora breve de paciencia / paso a paso. */
  @Prop({ required: true, trim: true })
  text: string;
}

export const ReflexionHoySchema = SchemaFactory.createForClass(ReflexionHoy);
