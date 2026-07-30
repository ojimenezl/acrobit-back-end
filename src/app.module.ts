import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HabitsModule } from './modules/habits/habits.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { TodayModule } from './modules/today/today.module';
import { RoutineModule } from './modules/routine/routine.module';
import { AchievementModule } from './modules/achievement/achievement.module';
import { ProfileModule } from './modules/profile/profile.module';
import { FirebaseModule } from './shared/firebase/firebase.module';
import { OpenAiModule } from './shared/openai/openai.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    FirebaseModule,
    OpenAiModule,
    UsersModule,
    HabitsModule,
    AuthModule,
    OnboardingModule,
    NotificationsModule,
    InteractionsModule,
    ChatModule,
    RoutineModule,
    TodayModule,
    AchievementModule,
    ProfileModule,
  ],
})
export class AppModule {}
