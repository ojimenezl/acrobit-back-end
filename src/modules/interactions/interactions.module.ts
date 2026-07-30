import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InteractionsService } from './interactions.service';
import { T10Scheduler } from './t10.scheduler';

@Module({
  imports: [UsersModule, forwardRef(() => NotificationsModule)],
  providers: [InteractionsService, T10Scheduler],
  exports: [InteractionsService],
})
export class InteractionsModule {}
