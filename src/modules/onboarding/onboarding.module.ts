import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { UsersModule } from '../users/users.module';
import { HabitsModule } from '../habits/habits.module';
import { HabitGroup, HabitGroupSchema } from '../habits/schemas/habit-group.schema';

@Module({
  imports: [
    UsersModule,
    HabitsModule,
    MongooseModule.forFeature([
      { name: HabitGroup.name, schema: HabitGroupSchema },
    ]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
