import { noticeHtml } from '../winger-authorized-vars.js';
import type { InvitationTemplate, InvitationVars } from '../invitation-vars.js';

export const enInvitation: InvitationTemplate = {
  subject: (v: InvitationVars): string => `Join ${v.business_name} on Stoki`,

  text: (v: InvitationVars): string =>
    [
      `You have been invited to join ${v.business_name} as staff.`,
      '',
      'Sign in or create your account, then open this link to accept:',
      v.accept_url,
      '',
      'The invitation expires soon — accept it while it is still valid.',
    ].join('\n'),

  html: (v: InvitationVars): string =>
    noticeHtml(
      `Join ${v.business_name} on Stoki`,
      `You have been invited to join ${v.business_name} as staff. Sign in or create your account, then open the link below to accept. The invitation expires soon.`,
      `Accept the invitation: ${v.accept_url}`,
    ),
};
