import {
  noticeHtml,
  type WingerAuthorizedTemplate,
  type WingerAuthorizedVars,
} from '../winger-authorized-vars.js';

export const swWingerAuthorized: WingerAuthorizedTemplate = {
  subject: (v: WingerAuthorizedVars): string =>
    `Sasa unaweza kuuza kwa ${v.business_name}`,

  text: (v: WingerAuthorizedVars): string =>
    [
      `${v.business_name} amekuidhinisha kama muuzaji.`,
      '',
      'Sasa unaweza kuona katalogi yao yenye bei zako za muuzaji na upatikanaji wa bidhaa.',
      '',
      `Fungua tovuti: ${v.portal_url}`,
    ].join('\n'),

  html: (v: WingerAuthorizedVars): string =>
    noticeHtml(
      `Sasa unaweza kuuza kwa ${v.business_name}`,
      `${v.business_name} amekuidhinisha kama muuzaji. Unaweza kuona katalogi yao yenye bei zako za muuzaji na upatikanaji wa bidhaa.`,
      `Fungua tovuti: ${v.portal_url}`,
    ),
};
