import type { RenderedEmail } from './low-stock-vars.js';

export interface InvitationVars {
  business_name: string;
  /** Absolute URL the invitee opens to accept. */
  accept_url: string;
}

export interface InvitationTemplate {
  subject(vars: InvitationVars): string;
  text(vars: InvitationVars): string;
  html(vars: InvitationVars): string;
}

export type { RenderedEmail };
