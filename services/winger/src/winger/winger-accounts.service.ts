import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import type { Prisma } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';
import { IdentityClient } from '../rpc/identity-client.js';
import { TenancyClient } from '../rpc/tenancy-client.js';
import { AuthorizeWingerDto } from './dto/authorize-winger.dto.js';

const outbox = new OutboxWriter();

export interface WingerAccountView {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  status: string;
  created_at: string;
}

@Injectable()
export class WingerAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityClient,
    private readonly tenancy: TenancyClient,
    private readonly config: ConfigService,
  ) {}

  private portalUrl(): string {
    const base =
      this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/winger`;
  }

  /** Owner authorizes a reseller by email or phone. Idempotent: re-authorizing
   * an already-active account is a no-op that emits no event. */
  async authorize(
    businessId: string,
    authorizedBy: string,
    dto: AuthorizeWingerDto,
  ): Promise<WingerAccountView> {
    const email = dto.email?.trim() || undefined;
    const phone = dto.phone?.trim() || undefined;
    if ((email && phone) || (!email && !phone)) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Provide exactly one of email or phone',
      });
    }

    const resolved = await this.identity.getUser({
      email,
      phone,
      create: true,
    });
    if (!resolved.found) {
      // `create: true` guarantees a user; treat an unexpected miss as upstream.
      throw new BadRequestException({
        code: 'user_unresolved',
        message: 'Could not resolve or create the reseller user',
      });
    }

    const membership = await this.tenancy.resolveMembership({
      business_id: businessId,
      user_id: resolved.user_id,
    });
    if (membership.found) {
      throw new ConflictException({
        code: 'already_a_member',
        message: 'This user is already a staff member of this business',
      });
    }

    const locale = resolved.locale ?? 'en';

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const existing = await tx.wingerAccount.findUnique({
        where: {
          businessId_userId: { businessId, userId: resolved.user_id },
        },
      });

      if (existing && existing.status === 'active') {
        return this.toView(existing, resolved.email ?? null, resolved.name);
      }

      const account = existing
        ? await tx.wingerAccount.update({
            where: { id: existing.id },
            data: { status: 'active', authorizedBy },
          })
        : await tx.wingerAccount.create({
            data: {
              businessId,
              userId: resolved.user_id,
              authorizedBy,
              status: 'active',
            },
          });

      await this.emitAuthorized(tx, businessId, account.id, resolved.user_id, {
        email: resolved.email ?? undefined,
        locale,
      });

      return this.toView(account, resolved.email ?? null, resolved.name);
    });
  }

  async list(businessId: string): Promise<WingerAccountView[]> {
    const rows = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.wingerAccount.findMany({ orderBy: { createdAt: 'desc' } }),
    );

    const views: WingerAccountView[] = [];
    for (const row of rows) {
      const user = await this.identity.getUser({ user_id: row.userId });
      views.push(
        this.toView(
          row,
          user.found ? (user.email ?? null) : null,
          user.found ? user.name : null,
        ),
      );
    }
    return views;
  }

  async setStatus(
    businessId: string,
    id: string,
    status: 'active' | 'suspended',
  ): Promise<WingerAccountView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const account = await tx.wingerAccount.findUnique({ where: { id } });
      if (!account || account.businessId !== businessId) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Winger account not found',
        });
      }

      if (account.status === status) {
        return this.toView(account, null, null);
      }

      const updated = await tx.wingerAccount.update({
        where: { id },
        data: { status },
      });

      if (status === 'suspended') {
        await outbox.write(tx, {
          subject: SUBJECTS.winger.wingerSuspended,
          payload: makeEnvelope({
            producer: 'winger',
            businessId,
            schemaVersion: SCHEMA_VERSION,
            payload: {
              business_id: businessId,
              winger_account_id: updated.id,
            },
          }),
        });
      } else {
        const user = await this.identity.getUser({ user_id: account.userId });
        await this.emitAuthorized(tx, businessId, updated.id, account.userId, {
          email: user.found ? (user.email ?? undefined) : undefined,
          locale: user.found ? (user.locale ?? 'en') : 'en',
        });
      }

      return this.toView(updated, null, null);
    });
  }

  private async emitAuthorized(
    tx: Prisma.TransactionClient,
    businessId: string,
    wingerAccountId: string,
    userId: string,
    contact: { email?: string; locale: string },
  ): Promise<void> {
    await outbox.write(tx, {
      subject: SUBJECTS.winger.wingerAuthorized,
      payload: makeEnvelope({
        producer: 'winger',
        businessId,
        schemaVersion: SCHEMA_VERSION,
        payload: {
          business_id: businessId,
          winger_account_id: wingerAccountId,
          user_id: userId,
          portal_url: this.portalUrl(),
          ...(contact.email ? { email: contact.email } : {}),
          locale: contact.locale,
        },
      }),
    });
  }

  private toView(
    row: {
      id: string;
      userId: string;
      status: string;
      createdAt: Date;
    },
    email: string | null,
    name: string | null,
  ): WingerAccountView {
    return {
      id: row.id,
      user_id: row.userId,
      email,
      name,
      status: row.status,
      created_at: row.createdAt.toISOString(),
    };
  }
}
