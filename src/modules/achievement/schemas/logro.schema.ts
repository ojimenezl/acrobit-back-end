import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LogroDocument = HydratedDocument<Logro>;

export type LogroElement = 'gem' | 'sword' | 'bonsai' | 'diamond';

@Schema({ _id: false })
export class LogroDay {
  @Prop({ required: true, min: 1 })
  day: number;

  /** Frase del elemento (semilla, gema, espada…). */
  @Prop({ required: true, trim: true })
  elementText: string;

  /** Frase dirigida al usuario. Usa {name} para el nombre. */
  @Prop({ required: true, trim: true })
  userText: string;
}

export const LogroDaySchema = SchemaFactory.createForClass(LogroDay);

@Schema({ timestamps: true, collection: 'logro' })
export class Logro {
  @Prop({
    required: true,
    unique: true,
    index: true,
    enum: ['gem', 'sword', 'bonsai', 'diamond'],
  })
  element: LogroElement;

  @Prop({ type: [LogroDaySchema], default: [] })
  days: LogroDay[];
}

export const LogroSchema = SchemaFactory.createForClass(Logro);
