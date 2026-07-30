import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HabitGroup, HabitGroupSchema } from './schemas/habit-group.schema';
import { RagChunk, RagChunkSchema } from './schemas/rag-chunk.schema';
import { HabitsService } from './habits.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HabitGroup.name, schema: HabitGroupSchema },
      { name: RagChunk.name, schema: RagChunkSchema },
    ]),
  ],
  providers: [HabitsService],
  exports: [HabitsService],
})
export class HabitsModule {}
