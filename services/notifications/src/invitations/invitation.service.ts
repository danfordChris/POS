import { Inject, Injectable, Logger } from '@nestjs/common';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { Prisma } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { TemplateRegistry } from '../templates/template-registry.js';

const outbox = new OutboxWriter();

export interface InvitationCreated {
  business_id: string;
  invitation_id: string;
  email: string;
  role: 'staff';
  accept_url: string;
  expires_at: string;
  business_name?: string;
  locale?: string;
}

/** Emails a staff invitation. Transactional (one recipient, sent immediately). */
@Injectable()
export class InvitationEmailService {
  private readonly logger = new Logger(InvitationEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateRegistry,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async record(e: InvitationCreated): Promise<void> {
    await this.prisma.runInTenantContext(e.business_id, async (tx) => {
      const biz = await tx.notificationBusiness.findUnique({
        where: { businessId: e.business_id },
      });
      const businessName = e.business_name ?? biz?.name ?? 'Your shop';
      const locale = e.locale || biz?.locale || 'en';

      let notificationId: string;
      try {
        const row = await tx.notification.create({
          data: {
            businessId: e.business_id,
            type: 'invitation',
            channel: 'email',
            status: 'queued',
            dedupeKey: `invitation:${e.invitation_id}`,
            payload: {
              invitation_id: e.invitation_id,
              email: e.email,
              role: e.role,
              accept_url: e.accept_url,
              expires_at: e.expires_at,
              business_name: businessName,
              locale,
            },
          },
        });
        notificationId = row.id;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return; // already handled this invitation
        }
        throw error;
      }

      const rendered = this.templates.renderInvitation(locale, {
        business_name: businessName,
        accept_url: e.accept_url,
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
              type: 'invitation',
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
              type: 'invitation',
              channel: 'email',
              error: message,
            },
          }),
        });
      }
    });
  }
}
