import { Inject, Injectable, Logger } from '@nestjs/common';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { Prisma } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { TemplateRegistry } from '../templates/template-registry.js';

const outbox = new OutboxWriter();

export interface WingerAuthorized {
  business_id: string;
  winger_account_id: string;
  user_id: string;
  portal_url: string;
  email?: string;
  locale: string;
}

/** Sends the reseller a localized "you've been authorized" email. Transactional
 * (one recipient, sent immediately), so it does not go through the digest job. */
@Injectable()
export class WingerAuthorizedService {
  private readonly logger = new Logger(WingerAuthorizedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateRegistry,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async record(e: WingerAuthorized): Promise<void> {
    await this.prisma.runInTenantContext(e.business_id, async (tx) => {
      const biz = await tx.notificationBusiness.findUnique({
        where: { businessId: e.business_id },
      });
      const businessName = biz?.name ?? 'Your shop';
      const locale = e.locale || biz?.locale || 'en';

      let notificationId: string;
      try {
        const row = await tx.notification.create({
          data: {
            businessId: e.business_id,
            type: 'winger_authorized',
            channel: 'email',
            status: e.email ? 'queued' : 'skipped',
            dedupeKey: `winger_authorized:${e.winger_account_id}`,
            payload: {
              winger_account_id: e.winger_account_id,
              user_id: e.user_id,
              email: e.email ?? null,
              locale,
              portal_url: e.portal_url,
              business_name: businessName,
            },
          },
        });
        notificationId = row.id;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return; // already handled this winger authorization
        }
        throw error;
      }

      if (!e.email) {
        this.logger.warn(
          `winger ${e.winger_account_id} authorized without an email; nothing sent`,
        );
        return;
      }

      const rendered = this.templates.renderWingerAuthorized(locale, {
        business_name: businessName,
        portal_url: e.portal_url,
      });

      try {
        await this.email.send({
          to: [e.email],
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });
        await tx.notification.update({
          where: { id: notificationId },
          data: { status: 'sent', sentAt: new Date() },
        });
        await outbox.write(tx, {
          subject: SUBJECTS.notifications.notificationSent,
          payload: makeEnvelope({
            producer: 'notifications',
            businessId: e.business_id,
            schemaVersion: SCHEMA_VERSION,
            payload: {
              business_id: e.business_id,
              notification_id: notificationId,
              type: 'winger_authorized',
              channel: 'email',
            },
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await tx.notification.update({
          where: { id: notificationId },
          data: { status: 'failed', attempts: 1, lastError: message },
        });
        await outbox.write(tx, {
          subject: SUBJECTS.notifications.notificationFailed,
          payload: makeEnvelope({
            producer: 'notifications',
            businessId: e.business_id,
            schemaVersion: SCHEMA_VERSION,
            payload: {
              business_id: e.business_id,
              notification_id: notificationId,
              type: 'winger_authorized',
              channel: 'email',
              error: message,
            },
          }),
        });
      }
    });
  }
}
