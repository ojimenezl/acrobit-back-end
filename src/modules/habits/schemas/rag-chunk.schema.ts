import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RagChunkDocument = HydratedDocument<RagChunk>;

export enum RagCategory {
  LIFESTYLE = 'lifestyle',
  PRACTICE = 'practice',
  PATIENCE = 'patience',
  IDENTITY = 'identity',
}

@Schema({ timestamps: true, collection: 'rag_chunks' })
export class RagChunk {
  @Prop({ type: Types.ObjectId, ref: 'HabitGroup', required: true, index: true })
  groupId: Types.ObjectId;

  @Prop({ required: true, index: true })
  groupKey: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    type: String,
    enum: RagCategory,
    default: RagCategory.PRACTICE,
    index: true,
  })
  category: RagCategory;
}

export const RagChunkSchema = SchemaFactory.createForClass(RagChunk);
