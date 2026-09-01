import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation.js';

/**
 * Loads `.env` from the repo root (api runs from `api/`) and validates it once at boot.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['../.env', '.env'],
    }),
  ],
})
export class ConfigModule {}
