import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UsersService } from '../users/users.service';
import { HabitsService } from '../habits/habits.service';
import { OpenAiService } from '../../shared/openai/openai.service';
import { HabitGroup, HabitGroupDocument } from '../habits/schemas/habit-group.schema';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly habitsService: HabitsService,
    private readonly openAi: OpenAiService,
    @InjectModel(HabitGroup.name)
    private readonly groupModel: Model<HabitGroupDocument>,
  ) {}

  async complete(userId: string, dto: CompleteOnboardingDto) {
    if (!dto.termsAccepted) {
      throw new BadRequestException('Debes aceptar los términos y condiciones.');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }
    if (user.onboardingCompleted) {
      return await this.buildResponse(user);
    }

    const existingGroups = await this.groupModel.find().select('key name').lean().exec();
    const existingLabels = existingGroups.map((g) => `${g.key} (${g.name})`);

    this.logger.log(`Analizando hábito para user=${userId}: "${dto.habit}"`);
    const analysis = await this.openAi.analyzeHabit(dto.habit.trim(), existingLabels);

    // Crear o reutilizar grupo
    let group = await this.habitsService.findGroupByKey(analysis.groupKey);
    let createdGroup = false;
    if (!group) {
      group = await this.habitsService.createGroup({
        key: analysis.groupKey,
        name: analysis.groupName,
        description: analysis.description,
        scopePrompt: analysis.scopePrompt,
      });
      createdGroup = true;
      this.logger.log(`Grupo nuevo creado: ${group.key}`);
    } else {
      this.logger.log(`Grupo reutilizado: ${group.key}`);
    }

    const groupId = String(group._id);
    const groupKey = group.key;
    const groupName = group.name || analysis.groupName;

    // RAG: si el grupo es nuevo o tiene poco contenido, alimentar
    const ragCount = await this.habitsService.countRagByGroupKey(groupKey);
    if (createdGroup || ragCount < 4) {
      await this.habitsService.addRagChunks(groupId, groupKey, analysis.ragChunks);
      this.logger.log(`RAG alimentado para ${groupKey} (+${analysis.ragChunks.length})`);
    }

    await this.habitsService.incrementMembers(groupId);

    const updated = await this.usersService.completeOnboarding(userId, {
      termsAccepted: true,
      notificationsEnabled: dto.notificationsEnabled,
      habitRaw: dto.habit.trim(),
      habitGroupId: groupId,
      habitGroupKey: groupKey,
      habitGroupName: groupName,
      identityTitle: analysis.identityTitle,
      identityRole: analysis.identityRole,
      identityTagline: analysis.identityTagline,
    });

    if (!updated) {
      throw new BadRequestException('No se pudo completar el onboarding.');
    }

    return await this.buildResponse(updated, group, createdGroup);
  }

  /** Devuelve el carnet/identidad del usuario (con grupo resuelto). */
  async getCard(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }
    if (!user.onboardingCompleted) {
      throw new BadRequestException('El onboarding aún no está completo.');
    }
    return await this.buildResponse(user);
  }

  private async resolveGroup(user: any, group?: HabitGroupDocument | null) {
    if (group) return group;
    if (user.habitGroupId) {
      return this.habitsService.findGroupById(String(user.habitGroupId));
    }
    if (user.habitGroupKey) {
      return this.habitsService.findGroupByKey(user.habitGroupKey);
    }
    return null;
  }

  private async buildResponse(
    user: any,
    group?: HabitGroupDocument | null,
    createdGroup = false,
  ) {
    const resolved = await this.resolveGroup(user, group);
    const groupName =
      user.habitGroupName ||
      resolved?.name ||
      null;
    const groupKey =
      user.habitGroupKey ||
      resolved?.key ||
      null;

    // Si el user aún no tiene el nombre denormalizado, lo rellenamos
    if (resolved && (!user.habitGroupName || !user.habitGroupKey)) {
      await this.usersService
        .setHabitGroupLabels(user.id || String(user._id), {
          habitGroupId: String(resolved._id),
          habitGroupKey: resolved.key,
          habitGroupName: resolved.name,
        })
        .catch(() => null);
    }

    return {
      createdGroup,
      user: {
        id: user.id || String(user._id),
        name: user.name,
        email: user.email,
        onboardingCompleted: user.onboardingCompleted,
        habitRaw: user.habitRaw,
        habitGroupKey: groupKey,
        habitGroupName: groupName,
        identityTitle: user.identityTitle,
        identityRole: user.identityRole,
        identityTagline: user.identityTagline,
        notificationsEnabled: user.notificationsEnabled,
        habitDay: user.habitDay ?? 0,
      },
      group: resolved
        ? {
            id: String(resolved._id),
            key: resolved.key,
            name: resolved.name,
            description: resolved.description,
          }
        : null,
      card: {
        memberName: user.name,
        identityTitle: user.identityTitle,
        identityRole: user.identityRole,
        identityTagline: user.identityTagline,
        habit: user.habitRaw,
        groupName,
        groupKey,
        protocol: 'ACROBIT',
      },
    };
  }
}
