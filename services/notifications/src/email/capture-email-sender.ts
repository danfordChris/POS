import type { EmailMessage, EmailSender } from './email-sender.js';

/**
 * In-memory sender for tests and offline dev. Records every message; `failNext`
 * makes the next N sends throw, to exercise the retry path.
 */
export class CaptureEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  failNext = 0;

  async send(msg: EmailMessage): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('capture: forced send failure');
    }
    this.sent.push(msg);
  }

  reset(): void {
    this.sent.length = 0;
    this.failNext = 0;
  }
}
