import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { OperatorAuthController } from './operator-auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { UserAuthGuard, OperatorAuthGuard } from './guards/jwt-auth.guard.js';
import { IdentityRpc } from '../rpc/identity.rpc.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', limit: 100, ttl: 60_000 }],
    }),
  ],
  controllers: [AuthController, OperatorAuthController],
  providers: [
    AuthService,
    TokenService,
    UserAuthGuard,
    OperatorAuthGuard,
    IdentityRpc,
    OutboxRelayService,
  ],
  exports: [TokenService, UserAuthGuard, OperatorAuthGuard, OutboxRelayService],
})
export class AuthModule {}
