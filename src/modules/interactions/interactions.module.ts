import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InteractionsService } from './interactions.service';
import { T10Scheduler } from './t10.scheduler';
import { InternalController } from './internal.controller';

@Module({
  imports: [UsersModule, forwardRef(() => NotificationsModule)],
  controllers: [InternalController],
  providers: [InteractionsService, T10Scheduler],
  exports: [InteractionsService, T10Scheduler],
})
export class InteractionsModule {}
