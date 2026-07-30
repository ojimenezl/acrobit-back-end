import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AchievementController } from './achievement.controller';
import { AchievementService } from './achievement.service';

@Module({
  imports: [UsersModule],
  controllers: [AchievementController],
  providers: [AchievementService],
})
export class AchievementModule {}
