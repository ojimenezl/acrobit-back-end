import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'El nombre es demasiado corto.' })
  @MaxLength(60)
  name: string;

  @IsEmail({}, { message: 'El correo no es válido.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  @MaxLength(72)
  password: string;
}
