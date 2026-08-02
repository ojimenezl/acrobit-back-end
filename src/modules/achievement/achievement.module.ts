import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { AchievementController } from './achievement.controller';
import { AchievementService } from './achievement.service';
import { LogroSeedService } from './logro-seed.service';
import { Logro, LogroSchema } from './schemas/logro.schema';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: Logro.name, schema: LogroSchema }]),
  ],
  controllers: [AchievementController],
  providers: [AchievementService, LogroSeedService],
  exports: [AchievementService],
})
export class AchievementModule {}
