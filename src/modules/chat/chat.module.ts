import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UsersModule } from '../users/users.module';
import { HabitsModule } from '../habits/habits.module';
import { InteractionsModule } from '../interactions/interactions.module';

@Module({
  imports: [UsersModule, HabitsModule, InteractionsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
