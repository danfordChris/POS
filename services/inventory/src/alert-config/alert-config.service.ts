import { Injectable } from '@nestjs/common';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { Prisma } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';
import { PutAlertConfigDto } from './dto/put-alert-config.dto.js';
import { AlertConfigView, toAlertConfigView } from './alert-config-views.js';

const outbox = new OutboxWriter();

@Injectable()
export class AlertConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current config, lazily creating the per-business default row on first read. */
  async get(businessId: string): Promise<AlertConfigView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const existing = await tx.alertConfig.findUnique({
        where: { businessId },
      });
      if (existing) return toAlertConfigView(existing);

      try {
        const created = await tx.alertConfig.create({ data: { businessId } });
        return toAlertConfigView(created);
      } catch (error) {
        // Concurrent first read created it — re-fetch.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const row = await tx.alertConfig.findUniqueOrThrow({
            where: { businessId },
          });
          return toAlertConfigView(row);
        }
        throw error;
      }
    });
  }

  /** Replace recipients + interval floor for the business. */
  async put(
    businessId: string,
    dto: PutAlertConfigDto,
  ): Promise<AlertConfigView> {
    const data = {
      recipients: dto.recipients,
      minIntervalHours: dto.min_interval_hours,
    };
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const row = await tx.alertConfig.upsert({
        where: { businessId },
        create: { businessId, ...data },
        update: data,
      });
      await outbox.write(tx, {
        subject: SUBJECTS.inventory.alertConfigChanged,
        payload: makeEnvelope({
          producer: 'inventory',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            min_interval_hours: row.minIntervalHours,
            recipients: Array.isArray(row.recipients)
              ? (row.recipients as string[])
              : [],
          },
        }),
      });
      return toAlertConfigView(row);
    });
  }
}
