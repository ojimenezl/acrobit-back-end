import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Sesión no válida.');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      onboardingCompleted: user.onboardingCompleted,
      identityTitle: user.identityTitle,
      identityRole: user.identityRole,
      identityTagline: user.identityTagline,
      habitRaw: user.habitRaw,
      habitGroupName: user.habitGroupName,
      habitGroupKey: user.habitGroupKey,
      notificationsEnabled: user.notificationsEnabled,
      habitDay: user.habitDay ?? 0,
      welcomeCompleted: user.welcomeCompleted ?? false,
    };
  }
}
