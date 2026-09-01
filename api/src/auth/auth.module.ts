import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { OperatorAuthController } from './operator-auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { UserAuthGuard, OperatorAuthGuard } from './guards/jwt-auth.guard.js';

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', limit: 100, ttl: 60_000 }],
    }),
  ],
  controllers: [AuthController, OperatorAuthController],
  providers: [AuthService, TokenService, UserAuthGuard, OperatorAuthGuard],
  exports: [TokenService, UserAuthGuard, OperatorAuthGuard],
})
export class AuthModule {}
