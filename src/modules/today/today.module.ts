import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { RoutineModule } from '../routine/routine.module';
import { ReflexionHoy, ReflexionHoySchema } from './schemas/reflexion-hoy.schema';
import { TodayController } from './today.controller';
import { TodayService } from './today.service';

@Module({
  imports: [
    UsersModule,
    RoutineModule,
    MongooseModule.forFeature([
      { name: ReflexionHoy.name, schema: ReflexionHoySchema },
    ]),
  ],
  controllers: [TodayController],
  providers: [TodayService],
})
export class TodayModule {}
