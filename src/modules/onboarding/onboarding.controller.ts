import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('complete')
  complete(@Req() req: any, @Body() dto: CompleteOnboardingDto) {
    return this.onboardingService.complete(req.user.id, dto);
  }

  /** Carnet / identidad actual (resuelve el nombre del grupo). */
  @Get('card')
  getCard(@Req() req: any) {
    return this.onboardingService.getCard(req.user.id);
  }
}
