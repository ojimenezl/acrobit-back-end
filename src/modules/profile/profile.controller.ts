import {
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
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() req: any, @Query('localDate') localDate: string) {
    return this.profileService.getProfile(
      req.user.id,
      localDate || this.fallbackDate(),
    );
  }

  @Post('reset-journey')
  @HttpCode(HttpStatus.OK)
  reset(@Req() req: any) {
    return this.profileService.resetJourney(req.user.id);
  }

  private fallbackDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
