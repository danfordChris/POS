import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SENDER } from './email-sender.js';
import { SmtpEmailSender } from './smtp-email-sender.js';
import { CaptureEmailSender } from './capture-email-sender.js';

/**
 * Provides `EMAIL_SENDER`. Swapping providers is config-only (`EMAIL_PROVIDER`);
 * no code changes outside this directory.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('EMAIL_PROVIDER', 'smtp');
        if (provider === 'capture') return new CaptureEmailSender();
        return new SmtpEmailSender({
          host: config.getOrThrow<string>('SMTP_HOST'),
          port: config.getOrThrow<number>('SMTP_PORT'),
          user: config.get<string>('SMTP_USER'),
          password: config.get<string>('SMTP_PASSWORD'),
          from: config.getOrThrow<string>('MAIL_FROM'),
        });
      },
    },
  ],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
