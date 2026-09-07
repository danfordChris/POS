import { escapeHtml, type RenderedEmail } from './low-stock-vars.js';

export interface WingerAuthorizedVars {
  business_name: string;
  /** Absolute URL the reseller opens to reach their portal. */
  portal_url: string;
}

export interface WingerAuthorizedTemplate {
  subject(vars: WingerAuthorizedVars): string;
  text(vars: WingerAuthorizedVars): string;
  html(vars: WingerAuthorizedVars): string;
}

/** Minimal HTML skeleton for a one-line transactional notice + a CTA link. */
export const noticeHtml = (
  heading: string,
  body: string,
  cta: string,
): string =>
  [
    '<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">',
    `<h2 style="font-size:16px;margin:0 0 8px">${escapeHtml(heading)}</h2>`,
    `<p style="margin:0 0 12px">${escapeHtml(body)}</p>`,
    `<p>${escapeHtml(cta)}</p>`,
    '</div>',
  ].join('');

export type { RenderedEmail };
