import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import {
  DisableNotificationsDto,
  RegisterFcmTokenDto,
  SendTestNotificationDto,
} from './dto/notifications.dto';
import { InteractionsService } from '../interactions/interactions.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly interactions: InteractionsService,
  ) {}

  @Get('inbox')
  inbox(
    @Req() req: any,
    @Query('localDate') localDate: string,
    @Query('localTime') localTime: string,
    @Query('timeZone') timeZone: string,
  ) {
    return this.interactions.getNotificationsInbox(
      req.user.id,
      localDate,
      localTime,
      timeZone,
    );
  }

  @Post('action')
  @HttpCode(HttpStatus.OK)
  async action(
    @Req() req: any,
    @Body()
    body: {
      action?: string;
      localDate?: string;
      localTime?: string;
      timeZone?: string;
      newGoldenHour?: string;
      adminBypass?: boolean;
    },
  ) {
    const n = new Date();
    const date =
      body?.localDate ||
      `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    await this.interactions.rememberTimeZone(req.user.id, body?.timeZone);
    await this.interactions.handleAction(req.user.id, body?.action || '', date, {
      newGoldenHour: body?.newGoldenHour,
      adminBypass: !!body?.adminBypass,
    });
    return this.interactions.getNotificationsInbox(
      req.user.id,
      date,
      body?.localTime,
      body?.timeZone,
    );
  }

  @Post('register-token')
  @HttpCode(HttpStatus.OK)
  registerToken(@Req() req: any, @Body() dto: RegisterFcmTokenDto) {
    return this.notificationsService.registerToken(req.user.id, dto.token);
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  disable(@Req() req: any, @Body() dto: DisableNotificationsDto) {
    return this.notificationsService.disable(req.user.id, dto.token);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  test(@Req() req: any, @Body() dto: SendTestNotificationDto) {
    return this.notificationsService.sendTest(req.user.id, dto.title, dto.body);
  }
}
