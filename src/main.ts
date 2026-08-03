import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Prefijo global para todas las rutas: /api/...
  app.setGlobalPrefix('api');

  // Validación automática de DTOs en toda la app
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS: lista en CORS_ORIGIN + orígenes Capacitor (APK / iOS)
  const configured = (config.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const capacitorOrigins = [
    'https://localhost',
    'capacitor://localhost',
    'http://localhost',
    'ionic://localhost',
  ];
  const origins = [...new Set([...configured, ...capacitorOrigins])];
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
  });

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`ACROBIT API escuchando en http://localhost:${port}/api`);
}
bootstrap();
