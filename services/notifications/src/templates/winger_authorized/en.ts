import {
  noticeHtml,
  type WingerAuthorizedTemplate,
  type WingerAuthorizedVars,
} from '../winger-authorized-vars.js';

export const enWingerAuthorized: WingerAuthorizedTemplate = {
  subject: (v: WingerAuthorizedVars): string =>
    `You can now sell for ${v.business_name}`,

  text: (v: WingerAuthorizedVars): string =>
    [
      `${v.business_name} has authorized you as a reseller.`,
      '',
      'You can now see their catalog with your reseller prices and stock availability.',
      '',
      `Open the portal: ${v.portal_url}`,
    ].join('\n'),

  html: (v: WingerAuthorizedVars): string =>
    noticeHtml(
      `You can now sell for ${v.business_name}`,
      `${v.business_name} has authorized you as a reseller. You can see their catalog with your reseller prices and stock availability.`,
      `Open the portal: ${v.portal_url}`,
    ),
};
