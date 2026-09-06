import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ContactUpsert {
  businessId: string;
  userId: string;
  role: 'owner' | 'staff';
  email?: string | null;
  locale?: string | null;
}

/**
 * Maintains `notification_contact` — a read-only projection of tenancy
 * membership. All writes are tenant-scoped; the emitting service (`tenancy`)
 * stays the owner.
 */
@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(c: ContactUpsert): Promise<void> {
    const data = {
      role: c.role,
      email: c.email ?? null,
      locale: c.locale ?? 'en',
      active: true,
    };
    await this.prisma.runInTenantContext(c.businessId, (tx) =>
      tx.notificationContact.upsert({
        where: {
          businessId_userId: {
            businessId: c.businessId,
            userId: c.userId,
          },
        },
        create: { businessId: c.businessId, userId: c.userId, ...data },
        update: data,
      }),
    );
  }

  async suspend(businessId: string, userId: string): Promise<void> {
    await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.notificationContact.updateMany({
        where: { userId },
        data: { active: false },
      }),
    );
  }
}
