import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { MESSAGE_BUS } from '@pos/nest-common';
import {
  SUBJECTS,
  getUserRequest,
  type MessageBus,
  verifyTokenRequest,
} from '@pos/contracts';
import { AuthService } from '../auth/auth.service.js';
import { TokenService } from '../auth/token.service.js';

/** Registers the identity service's NATS request/reply handlers. */
@Injectable()
export class IdentityRpc implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdentityRpc.name);

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.reply(SUBJECTS.identity.getUser, async (raw) => {
      const query = getUserRequest.parse(raw);
      const user = await this.auth.findUserForRpc(query);
      if (!user) return { found: false };
      return {
        found: true,
        user_id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        disabled: user.disabledAt !== null,
      };
    });

    await this.bus.reply(SUBJECTS.identity.verifyToken, async (raw) => {
      const { access_token } = verifyTokenRequest.parse(raw);
      try {
        const claims = this.tokens.verifyAccessToken(access_token);
        return {
          valid: true,
          sub: claims.sub,
          aud: claims.aud,
          typ: claims.typ,
        };
      } catch {
        return { valid: false };
      }
    });

    this.logger.log('RPC handlers registered (getUser, verifyToken)');
  }
}
