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
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('thread')
  thread(
    @Req() req: any,
    @Query('localDate') localDate: string,
    @Query('localTime') localTime: string,
    @Query('timeZone') timeZone: string,
  ) {
    return this.chatService.getThread(req.user.id, localDate, localTime, timeZone);
  }

  @Get('welcome')
  welcome(
    @Req() req: any,
    @Query('localDate') localDate: string,
    @Query('localTime') localTime: string,
    @Query('timeZone') timeZone: string,
  ) {
    return this.chatService.getThread(req.user.id, localDate, localTime, timeZone);
  }

  @Post('welcome/thanks')
  @HttpCode(HttpStatus.OK)
  thanks(
    @Req() req: any,
    @Body() body: { localDate?: string; localTime?: string; timeZone?: string },
  ) {
    return this.chatService.thankWelcome(
      req.user.id,
      body?.localDate,
      body?.localTime,
      body?.timeZone,
    );
  }

  @Post('action')
  @HttpCode(HttpStatus.OK)
  action(
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
    const date =
      body?.localDate ||
      (() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
      })();
    return this.chatService.action(req.user.id, body?.action || '', date, {
      newGoldenHour: body?.newGoldenHour,
      adminBypass: !!body?.adminBypass,
      localTime: body?.localTime,
      timeZone: body?.timeZone,
    });
  }

  @Post('clear')
  @HttpCode(HttpStatus.OK)
  clear(
    @Req() req: any,
    @Body() body: { localDate?: string; localTime?: string; timeZone?: string },
  ) {
    return this.chatService.clearChat(
      req.user.id,
      body?.localDate,
      body?.localTime,
      body?.timeZone,
    );
  }
}
