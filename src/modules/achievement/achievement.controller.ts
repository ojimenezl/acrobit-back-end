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
import { AchievementService } from './achievement.service';

@Controller('achievement')
@UseGuards(JwtAuthGuard)
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get()
  getState(@Req() req: any, @Query('localDate') localDate: string) {
    return this.achievementService.getState(req.user.id, localDate);
  }

  @Post('choose')
  @HttpCode(HttpStatus.OK)
  async choose(
    @Req() req: any,
    @Body() body: { key?: string; adminBypass?: boolean; localDate?: string },
  ) {
    await this.achievementService.choose(
      req.user.id,
      body?.key || '',
      !!body?.adminBypass,
    );
    return this.achievementService.getState(req.user.id, body?.localDate);
  }
}
