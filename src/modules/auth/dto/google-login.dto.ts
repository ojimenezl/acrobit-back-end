import { IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @MinLength(10, { message: 'Token de Google inválido.' })
  idToken: string;
}
