import { Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailSender } from './email-sender.js';

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

/** Sends via SMTP (Mailpit in local dev). Translation only — no business logic. */
export class SmtpEmailSender implements EmailSender {
  private readonly logger = new Logger(SmtpEmailSender.name);
  private readonly transport: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth: config.user
        ? { user: config.user, pass: config.password ?? '' }
        : undefined,
    });
  }

  async send(msg: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.config.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    this.logger.debug(`sent "${msg.subject}" to ${msg.to.join(', ')}`);
  }
}
