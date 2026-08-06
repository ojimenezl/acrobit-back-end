import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  @MinLength(20)
  token: string;

  /** Si true, deja solo este token (útil al registrar desde el APK y evitar tokens web viejos). */
  @IsOptional()
  @IsBoolean()
  replaceAll?: boolean;
}

export class DisableNotificationsDto {
  @IsOptional()
  @IsString()
  token?: string;
}

export class SendTestNotificationDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

export class SetNotificationsDto {
  @IsBoolean()
  enabled: boolean;
}
