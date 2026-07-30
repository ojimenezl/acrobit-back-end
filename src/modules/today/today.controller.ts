import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TodayService } from './today.service';

@Controller('today')
@UseGuards(JwtAuthGuard)
export class TodayController {
  constructor(private readonly todayService: TodayService) {}

  @Get()
  getToday(
    @Req() req: any,
    @Query('localDate') localDate: string,
    @Query('timeZone') timeZone: string,
  ) {
    return this.todayService.getToday(
      req.user.id,
      localDate || this.fallbackDate(),
      timeZone,
    );
  }

  @Put('golden-hour')
  @HttpCode(HttpStatus.OK)
  setGoldenHour(
    @Req() req: any,
    @Body()
    body: {
      time?: string;
      localDate?: string;
      adminBypass?: boolean;
      timeZone?: string;
    },
  ) {
    return this.todayService.setGoldenHour(
      req.user.id,
      body?.time || '',
      body?.localDate || this.fallbackDate(),
      !!body?.adminBypass,
      body?.timeZone,
    );
  }

  @Post('status/cycle')
  @HttpCode(HttpStatus.OK)
  cycleStatus(@Req() req: any, @Body() body: { localDate?: string }) {
    return this.todayService.cycleStatus(
      req.user.id,
      body?.localDate || this.fallbackDate(),
    );
  }

  private fallbackDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
