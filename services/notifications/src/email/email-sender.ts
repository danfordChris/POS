export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}

/** The only outbound path for email. No handler calls SMTP directly. */
export interface EmailSender {
  send(msg: EmailMessage): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
