import { Injectable, NotFoundException } from '@nestjs/common';
import { Business, Prisma } from '#prisma';
import { uuidv7 } from 'uuidv7';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the business and the caller's Owner membership in one tenant-scoped transaction. */
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
}
