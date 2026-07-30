import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protege rutas: requiere un JWT válido en el header Authorization: Bearer <token>. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
