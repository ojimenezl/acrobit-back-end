import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * Conexión centralizada a MongoDB Atlas (base ACROBIT_BD).
 * La URI se lee de la variable de entorno MONGODB_URI.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        dbName: 'ACROBIT_BD',
      }),
    }),
  ],
})
export class DatabaseModule {}
