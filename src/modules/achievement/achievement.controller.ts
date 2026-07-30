import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AchievementService } from './achievement.service';

@Controller('achievement')
@UseGuards(JwtAuthGuard)
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get()
  getState(@Req() req: any) {
    return this.achievementService.getState(req.user.id);
  }

  @Post('choose')
  @HttpCode(HttpStatus.OK)
  choose(@Req() req: any, @Body() body: { key?: string }) {
    return this.achievementService.choose(req.user.id, body?.key || '');
  }
}
