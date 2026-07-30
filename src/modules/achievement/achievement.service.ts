import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

export const MOTIVATORS = [
  {
    key: 'gem' as const,
    title: 'Pulir una gema',
    latin: 'GEMMA',
    hint: 'Cada día quita una impureza.',
  },
  {
    key: 'sword' as const,
    title: 'Forjar una espada',
    latin: 'GLADIUS',
    hint: 'El fuego y el tiempo dan forma.',
  },
  {
    key: 'bonsai' as const,
    title: 'Cultivar un bonsái',
    latin: 'ARBOR',
    hint: 'Crece lento, pero crece cierto.',
  },
  {
    key: 'diamond' as const,
    title: 'Formar un diamante',
    latin: 'ADAMAS',
    hint: 'La presión paciente hace lo eterno.',
  },
];

export type MotivatorKey = (typeof MOTIVATORS)[number]['key'];

@Injectable()
export class AchievementService {
  constructor(private readonly usersService: UsersService) {}

  async getState(userId: string) {
    const user = await this.requireUser(userId);
    const selected = user.motivatorObject || null;
    return {
      selected,
      canChoose: !selected,
      habitDay: Math.max(1, user.habitDay || 1),
      motivators: MOTIVATORS.map((m) => ({
        ...m,
        selected: selected === m.key,
      })),
    };
  }

  async choose(userId: string, key: string) {
    const valid = MOTIVATORS.some((m) => m.key === key);
    if (!valid) throw new BadRequestException('Objeto inválido.');

    const user = await this.requireUser(userId);
    if (user.motivatorObject) {
      throw new BadRequestException('Ya elegiste tu objeto de paciencia.');
    }

    await this.usersService.setMotivatorObject(userId, key as MotivatorKey);
    return this.getState(userId);
  }

  private async requireUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    if (!user.onboardingCompleted) {
      throw new BadRequestException('Completa el onboarding primero.');
    }
    return user;
  }
}
