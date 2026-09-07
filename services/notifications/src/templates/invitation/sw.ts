import { noticeHtml } from '../winger-authorized-vars.js';
import type { InvitationTemplate, InvitationVars } from '../invitation-vars.js';

export const swInvitation: InvitationTemplate = {
  subject: (v: InvitationVars): string =>
    `Jiunge na ${v.business_name} kwenye Stoki`,

  text: (v: InvitationVars): string =>
    [
      `Umealikwa kujiunge na ${v.business_name} kama mfanyakazi.`,
      '',
      'Ingia au fungua akaunti yako, kisha fungua kiungo hiki kukubali:',
      v.accept_url,
      '',
      'Mwaliko utaisha muda si mrefu — kubali sasa ukiwa bado halali.',
    ].join('\n'),

  html: (v: InvitationVars): string =>
    noticeHtml(
      `Jiunge na ${v.business_name} kwenye Stoki`,
      `Umealikwa kujiunge na ${v.business_name} kama mfanyakazi. Ingia au fungua akaunti yako, kisha fungua kiungo hapa chini kukubali. Mwaliko utaisha muda si mrefu.`,
      `Kubali mwaliko: ${v.accept_url}`,
    ),
};
