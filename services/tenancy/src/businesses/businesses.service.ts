import { Injectable, NotFoundException } from '@nestjs/common';
import { Business, Membership, Prisma } from '#prisma';
import { uuidv7 } from 'uuidv7';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';

const outbox = new OutboxWriter();

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the business + the caller's Owner membership, and emits BusinessCreated + MembershipCreated — all in one tenant-scoped transaction. */
  async create(userId: string, dto: CreateBusinessDto): Promise<Business> {
    const businessId = uuidv7();
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const business = await tx.business.create({
        data: {
          id: businessId,
          name: dto.name,
          country: dto.country ?? 'TZ',
          currency: dto.currency ?? 'TZS',
          locale: dto.locale ?? 'en',
          timezone: dto.timezone ?? 'Africa/Dar_es_Salaam',
        },
      });
      await tx.membership.create({
        data: { businessId, userId, role: 'owner', status: 'active' },
      });

      await outbox.write(tx, {
        subject: SUBJECTS.tenancy.businessCreated,
        payload: makeEnvelope({
          producer: 'tenancy',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            name: business.name,
            currency: business.currency,
            locale: business.locale,
            owner_user_id: userId,
          },
        }),
      });
      await outbox.write(tx, {
        subject: SUBJECTS.tenancy.membershipCreated,
        payload: makeEnvelope({
          producer: 'tenancy',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: { business_id: businessId, user_id: userId, role: 'owner' },
        }),
      });

      return business;
    });
  }

  async get(businessId: string): Promise<Business> {
    const business = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.business.findUnique({ where: { id: businessId } }),
    );
    if (!business) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Business not found',
      });
    }
    return business;
  }

  async update(businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    const data: Prisma.BusinessUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;

    try {
      return await this.prisma.runInTenantContext(businessId, (tx) =>
        tx.business.update({ where: { id: businessId }, data }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Business not found',
        });
      }
      throw error;
    }
  }

  async listMembers(businessId: string): Promise<Membership[]> {
    return this.prisma.runInTenantContext(businessId, (tx) =>
      tx.membership.findMany({ orderBy: { joinedAt: 'asc' } }),
    );
  }

  /** Owner suspends / reactivates a member; emits MembershipSuspended on suspend. */
  async setMemberStatus(
    businessId: string,
    userId: string,
    status: 'active' | 'suspended',
  ): Promise<Membership> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { businessId_userId: { businessId, userId } },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Member not found',
        });
      }
      const updated = await tx.membership.update({
        where: { businessId_userId: { businessId, userId } },
        data: { status },
      });
      if (status === 'suspended' && existing.status !== 'suspended') {
        await outbox.write(tx, {
          subject: SUBJECTS.tenancy.membershipSuspended,
          payload: makeEnvelope({
            producer: 'tenancy',
            businessId,
            schemaVersion: SCHEMA_VERSION,
            payload: { business_id: businessId, user_id: userId },
          }),
        });
      }
      return updated;
    });
  }

  /** For the internal membership endpoint + resolveMembership RPC. */
  async findMembership(
    businessId: string,
    userId: string,
  ): Promise<Membership | null> {
    return this.prisma.runInTenantContext(businessId, (tx) =>
      tx.membership.findUnique({
        where: { businessId_userId: { businessId, userId } },
      }),
    );
  }
}
