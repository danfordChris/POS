import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '#prisma';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { IdentityClient } from '../rpc/tenancy.rpc.js';

const outbox = new OutboxWriter();

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface InvitationView {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityClient,
    private readonly config: ConfigService,
  ) {}

  private toView(row: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
  }): InvitationView {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      expires_at: row.expiresAt.toISOString(),
      created_at: row.createdAt.toISOString(),
    };
  }

  /** Owner invites a Staff member by email. Returns the non-secret view; the
   * token is only ever in the `InvitationCreated` event / email. */
  async create(
    businessId: string,
    createdBy: string,
    email: string,
  ): Promise<InvitationView> {
    const token = randomBytes(24).toString('base64url');
    const ttlDays = this.config.get<number>('INVITATION_TTL_DAYS', 7);
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
    const webBase = (
      this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
      });
      const invitation = await tx.invitation.create({
        data: {
          businessId,
          email,
          role: 'staff',
          tokenHash: hashToken(token),
          expiresAt,
          createdBy,
        },
      });
      await outbox.write(tx, {
        subject: SUBJECTS.tenancy.invitationCreated,
        payload: makeEnvelope({
          producer: 'tenancy',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            invitation_id: invitation.id,
            email,
            role: 'staff',
            accept_url: `${webBase}/invitations/accept?token=${token}`,
            expires_at: expiresAt.toISOString(),
            ...(business?.name ? { business_name: business.name } : {}),
            ...(business?.locale ? { locale: business.locale } : {}),
          },
        }),
      });
      return this.toView(invitation);
    });
  }

  async list(businessId: string): Promise<InvitationView[]> {
    const rows = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.invitation.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map((r) => this.toView(r));
  }

  async revoke(businessId: string, id: string): Promise<InvitationView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const row = await tx.invitation.findUnique({ where: { id } });
      if (!row || row.businessId !== businessId) {
        throw new BadRequestException({
          code: 'not_found',
          message: 'Invitation not found',
        });
      }
      const updated =
        row.status === 'pending'
          ? await tx.invitation.update({
              where: { id },
              data: { status: 'revoked' },
            })
          : row;
      return this.toView(updated);
    });
  }

  /** An authenticated invitee redeems the token → a Staff membership. */
  async accept(
    userId: string,
    token: string,
  ): Promise<{ business_id: string; role: string; status: string }> {
    const tokenHash = hashToken(token);

    // Unscoped read by the unique token_hash (RLS read is relaxed for this).
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (
      !invitation ||
      invitation.status === 'accepted' ||
      invitation.status === 'revoked'
    ) {
      throw new GoneException({
        code: 'invitation_expired',
        message: 'This invitation is no longer valid',
      });
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      await this.prisma
        .runInTenantContext(invitation.businessId, (tx) =>
          tx.invitation.updateMany({
            where: { id: invitation.id, status: 'pending' },
            data: { status: 'expired' },
          }),
        )
        .catch(() => undefined);
      throw new GoneException({
        code: 'invitation_expired',
        message: 'This invitation has expired',
      });
    }

    const businessId = invitation.businessId;
    let email: string | undefined;
    let locale: string | undefined;
    try {
      const user = await this.identity.getUser({ user_id: userId });
      if (user.found) {
        email = user.email ?? undefined;
        locale = user.locale ?? undefined;
      }
    } catch {
      // best effort — the notifications projection can also be fed later
    }

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      // Re-check under the tenant lock: another accept may have won the race.
      const fresh = await tx.invitation.findUnique({
        where: { id: invitation.id },
      });
      if (!fresh || fresh.status !== 'pending') {
        throw new GoneException({
          code: 'invitation_expired',
          message: 'This invitation is no longer valid',
        });
      }

      let membership;
      try {
        membership = await tx.membership.create({
          data: {
            businessId,
            userId,
            role: 'staff',
            status: 'active',
            invitedBy: fresh.createdBy,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException({
            code: 'already_a_member',
            message: 'You are already a member of this business',
          });
        }
        throw error;
      }

      await tx.invitation.update({
        where: { id: fresh.id },
        data: {
          status: 'accepted',
          acceptedBy: userId,
          acceptedAt: new Date(),
        },
      });

      await outbox.write(tx, {
        subject: SUBJECTS.tenancy.membershipCreated,
        payload: makeEnvelope({
          producer: 'tenancy',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            user_id: userId,
            role: 'staff',
            ...(email ? { email } : {}),
            ...(locale ? { locale } : {}),
          },
        }),
      });
      await outbox.write(tx, {
        subject: SUBJECTS.tenancy.invitationAccepted,
        payload: makeEnvelope({
          producer: 'tenancy',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            invitation_id: fresh.id,
            user_id: userId,
          },
        }),
      });

      return {
        business_id: businessId,
        role: membership.role,
        status: membership.status,
      };
    });
  }
}
