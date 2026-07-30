import { IsBoolean, IsString, MinLength, MaxLength } from 'class-validator';

export class CompleteOnboardingDto {
  @IsBoolean()
  termsAccepted: boolean;

  @IsBoolean()
  notificationsEnabled: boolean;

  @IsString()
  @MinLength(3, { message: 'Describe tu hábito con al menos unas pocas palabras.' })
  @MaxLength(280)
  habit: string;
}
