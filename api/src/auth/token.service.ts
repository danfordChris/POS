import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { AccessTokenClaims, SubjectType } from './auth.constants.js';

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessTtlSeconds = Number(
      config.get('ACCESS_TOKEN_TTL_SECONDS') ?? 900,
    );
    this.refreshTtlMs =
      Number(config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30) * 24 * 60 * 60 * 1000;
  }

  issueAccessToken(
    subjectId: string,
    audience: SubjectType,
  ): { token: string; expiresIn: number } {
    const token = this.jwt.sign(
      { typ: 'access' },
      {
        secret: this.accessSecret,
        subject: subjectId,
        audience,
        expiresIn: this.accessTtlSeconds,
      },
    );
    return { token, expiresIn: this.accessTtlSeconds };
  }

  /** Verifies signature and expiry only. Audience is checked by the guard so it
   * can return a distinct `wrong_token_audience` code. */
  verifyAccessToken(token: string): AccessTokenClaims {
    return this.jwt.verify<AccessTokenClaims>(token, {
      secret: this.accessSecret,
    });
  }

  generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = randomBytes(32).toString('base64url');
    return {
      raw,
      hash: this.hashRefreshToken(raw),
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
    };
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
