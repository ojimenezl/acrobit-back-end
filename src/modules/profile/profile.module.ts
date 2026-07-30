import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RoutineModule } from '../routine/routine.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [UsersModule, RoutineModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
