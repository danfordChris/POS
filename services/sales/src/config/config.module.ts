import { Module } from '@nestjs/common';
import { NestConfigModule, makeEnvValidator } from '@pos/nest-common';
import { envSchema } from './env.js';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: makeEnvValidator(envSchema),
      envFilePath: ['../../.env', '.env'],
    }),
  ],
})
export class ConfigModule {}
