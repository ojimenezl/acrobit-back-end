import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoutineService } from './routine.service';

@Controller('routine')
@UseGuards(JwtAuthGuard)
export class RoutineController {
  constructor(private readonly routineService: RoutineService) {}

  @Get('week')
  getWeek(@Req() req: any, @Query('localDate') localDate: string) {
    const date = localDate || this.fallbackDate();
    return this.routineService.getWeek(req.user.id, date);
  }

  private fallbackDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
