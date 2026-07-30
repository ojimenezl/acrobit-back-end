import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserDocument, AuthProvider } from '../users/schemas/user.schema';
import { FirebaseAdminService } from '../../shared/firebase/firebase-admin.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este correo.');
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: hash,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Login / registro con Google:
   * 1) Verifica el idToken con Firebase Admin (real).
   * 2) Busca o crea el usuario en MongoDB.
   * 3) Devuelve el JWT de ACROBIT.
   */
  async loginWithGoogle(dto: GoogleLoginDto) {
    let decoded;
    try {
      decoded = await this.firebaseAdmin.verifyIdToken(dto.idToken);
    } catch {
      throw new UnauthorizedException('Token de Google no válido.');
    }

    const firebaseUid = decoded.uid;
    const email = (decoded.email ?? '').toLowerCase().trim();
    const name =
      decoded.name ||
      decoded.email?.split('@')[0] ||
      'Usuario ACROBIT';

    if (!email) {
      throw new UnauthorizedException(
        'La cuenta de Google no tiene un correo asociado.',
      );
    }

    // 1) Ya existe por firebaseUid
    const byUid = await this.usersService.findByFirebaseUid(firebaseUid);
    if (byUid) {
      return this.buildAuthResponse(byUid);
    }

    // 2) Existe por email (cuenta local previa) → vincular
    const byEmail = await this.usersService.findByEmail(email);
    if (byEmail) {
      const linked = await this.usersService.linkFirebaseUid(
        byEmail.id,
        firebaseUid,
      );
      if (!linked) {
        throw new UnauthorizedException('No se pudo vincular la cuenta de Google.');
      }
      return this.buildAuthResponse(linked);
    }

    // 3) Usuario nuevo
    const created = await this.usersService.create({
      name,
      email,
      provider: AuthProvider.GOOGLE,
      firebaseUid,
    });

    return this.buildAuthResponse(created);
  }

  private buildAuthResponse(user: UserDocument) {
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
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
      },
    };
  }
}
