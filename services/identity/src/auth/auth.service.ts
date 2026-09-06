import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '#prisma';
import { randomUUID } from 'node:crypto';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { hashPassword, verifyPassword } from './password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SUBJECT_OPERATOR,
  SUBJECT_USER,
  SessionTokens,
  SubjectType,
} from './auth.constants.js';
import { TokenService } from './token.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

const outbox = new OutboxWriter();

/** Sentinel `password_hash` for a provisioned-but-unclaimed user. Not a valid
 * argon2 encoded string, so `verifyPassword` returns false for any input. */
const UNCLAIMED_PASSWORD_HASH = '!unclaimed';

export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  locale: string;
  createdAt: Date;
}

export type UserMe = PublicUser & { memberships: []; wingerAccounts: [] };

export interface OperatorMe {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async registerUser(dto: RegisterDto): Promise<PublicUser> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Validation failed',
        details: [
          { field: 'email', issue: 'either email or phone is required' },
        ],
      });
    }

    const passwordHash = await hashPassword(dto.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            passwordHash,
            locale: dto.locale ?? 'en',
          },
        });
        await outbox.write(tx, {
          subject: SUBJECTS.identity.userRegistered,
          payload: makeEnvelope({
            producer: 'identity',
            businessId: null,
            schemaVersion: SCHEMA_VERSION,
            payload: {
              user_id: created.id,
              email: created.email,
              phone: created.phone,
            },
          }),
        });
        return created;
      });
      return this.toPublicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'conflict',
          message: 'A user with that email or phone already exists',
        });
      }
      throw error;
    }
  }

  async loginUser(dto: LoginDto, userAgent?: string): Promise<SessionTokens> {
    const identifier = this.requireIdentifier(dto);
    const user = await this.prisma.user.findFirst({ where: identifier });
    const passwordOk =
      user != null &&
      user.disabledAt == null &&
      (await verifyPassword(user.passwordHash, dto.password).catch(
        () => false,
      ));

    if (!user || !passwordOk) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Invalid credentials',
      });
    }

    return this.issueSession(SUBJECT_USER, user.id, userAgent);
  }

  async loginOperator(
    dto: LoginDto,
    userAgent?: string,
  ): Promise<SessionTokens> {
    if (!dto.email) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Validation failed',
        details: [
          { field: 'email', issue: 'email is required for operator login' },
        ],
      });
    }
    const operator = await this.prisma.operator.findUnique({
      where: { email: dto.email },
    });
    const passwordOk =
      operator != null &&
      operator.disabledAt == null &&
      (await verifyPassword(operator.passwordHash, dto.password).catch(
        () => false,
      ));

    if (!operator || !passwordOk) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Invalid credentials',
      });
    }

    return this.issueSession(SUBJECT_OPERATOR, operator.id, userAgent);
  }

  async refresh(dto: RefreshDto, userAgent?: string): Promise<SessionTokens> {
    const tokenHash = this.tokens.hashRefreshToken(dto.refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Invalid refresh token',
      });
    }

    if (existing.revokedAt || existing.rotatedAt) {
      // Reuse of a spent token: revoke the whole rotation family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Refresh token has already been used',
      });
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Refresh token expired',
      });
    }

    const next = this.tokens.generateRefreshToken();
    const created = await this.prisma.refreshToken.create({
      data: {
        tokenHash: next.hash,
        subjectType: existing.subjectType,
        subjectId: existing.subjectId,
        familyId: existing.familyId,
        expiresAt: next.expiresAt,
        userAgent: userAgent ?? null,
      },
    });
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { rotatedAt: new Date(), replacedById: created.id },
    });

    const access = this.tokens.issueAccessToken(
      existing.subjectId,
      existing.subjectType as SubjectType,
    );
    return {
      accessToken: access.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      refreshToken: next.raw,
    };
  }

  async logout(dto: RefreshDto): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(dto.refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (existing) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    // Idempotent: an unknown or already-revoked token still resolves successfully.
  }

  async meForUser(userId: string): Promise<UserMe> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.disabledAt) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'User is not active',
      });
    }
    return { ...this.toPublicUser(user), memberships: [], wingerAccounts: [] };
  }

  async meForOperator(operatorId: string): Promise<OperatorMe> {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
    });
    if (!operator || operator.disabledAt) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Operator is not active',
      });
    }
    return {
      id: operator.id,
      name: operator.name,
      email: operator.email,
      createdAt: operator.createdAt,
    };
  }

  /** Lookup for the `pos.rpc.identity.getUser` handler. */
  async findUserForRpc(query: {
    user_id?: string;
    email?: string;
    phone?: string;
    create?: boolean;
  }): Promise<User | null> {
    if (query.user_id)
      return this.prisma.user.findUnique({ where: { id: query.user_id } });
    if (query.email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: query.email },
      });
      if (byEmail || !query.create) return byEmail;
      return this.createShellUser({ email: query.email });
    }
    if (query.phone) {
      const byPhone = await this.prisma.user.findUnique({
        where: { phone: query.phone },
      });
      if (byPhone || !query.create) return byPhone;
      return this.createShellUser({ phone: query.phone });
    }
    return null;
  }

  /**
   * Provision a passwordless user that cannot sign in until a password is set
   * (the stored hash is a sentinel that `verifyPassword` always rejects). Used
   * when an Owner authorizes a winger by an email/phone that has never
   * registered. Emits `UserRegistered` in the same transaction.
   */
  private async createShellUser(identifier: {
    email?: string;
    phone?: string;
  }): Promise<User> {
    const name = identifier.email
      ? identifier.email.split('@')[0]
      : (identifier.phone ?? 'user');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: identifier.email ?? null,
          phone: identifier.phone ?? null,
          passwordHash: UNCLAIMED_PASSWORD_HASH,
        },
      });
      await outbox.write(tx, {
        subject: SUBJECTS.identity.userRegistered,
        payload: makeEnvelope({
          producer: 'identity',
          businessId: null,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            user_id: user.id,
            email: user.email,
            phone: user.phone,
          },
        }),
      });
      return user;
    });
  }

  private async issueSession(
    subjectType: SubjectType,
    subjectId: string,
    userAgent?: string,
  ): Promise<SessionTokens> {
    const access = this.tokens.issueAccessToken(subjectId, subjectType);
    const refresh = this.tokens.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refresh.hash,
        subjectType,
        subjectId,
        familyId: randomUUID(),
        expiresAt: refresh.expiresAt,
        userAgent: userAgent ?? null,
      },
    });
    return {
      accessToken: access.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      refreshToken: refresh.raw,
    };
  }

  private requireIdentifier(
    dto: LoginDto,
  ): { email: string } | { phone: string } {
    if (dto.email) return { email: dto.email };
    if (dto.phone) return { phone: dto.phone };
    throw new BadRequestException({
      code: 'validation_error',
      message: 'Validation failed',
      details: [{ field: 'email', issue: 'either email or phone is required' }],
    });
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      locale: user.locale,
      createdAt: user.createdAt,
    };
  }
}
