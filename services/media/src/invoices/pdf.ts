import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { InvoiceSnapshot } from './invoice-snapshot.js';

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN = 56;
const DARK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.47);
const LINE = rgb(0.85, 0.85, 0.88);

function money(minor: number, currency: string): string {
  // TZS has no minor unit; keep it simple and locale-free for the document.
  return `${currency} ${minor.toLocaleString('en-US')}`;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Render a one-page A4 invoice PDF from an `InvoiceIssued` snapshot. */
export async function renderInvoicePdf(inv: InvoiceSnapshot): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${inv.number}`);
  doc.setProducer('POS media service');
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const right = PAGE_W - MARGIN;
  let y = PAGE_H - MARGIN;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: typeof font; color?: typeof DARK } = {},
  ) => {
    page.drawText(s, {
      x,
      y: yy,
      size: opts.size ?? 10,
      font: opts.font ?? font,
      color: opts.color ?? DARK,
    });
  };
  const textRight = (
    s: string,
    xRight: number,
    yy: number,
    opts: { size?: number; font?: typeof font; color?: typeof DARK } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 10;
    text(s, xRight - f.widthOfTextAtSize(s, size), yy, opts);
  };

  // Header
  text(inv.business_name ?? 'Invoice', MARGIN, y, { size: 18, font: bold });
  textRight('INVOICE', right, y, { size: 18, font: bold, color: MUTED });
  y -= 18;
  textRight(`#${inv.number}`, right, y, { size: 11, color: MUTED });
  y -= 30;

  // Bill-to + meta
  text('BILL TO', MARGIN, y, { size: 8, font: bold, color: MUTED });
  textRight('ISSUED', right - 150, y, { size: 8, font: bold, color: MUTED });
  textRight(fmtDate(inv.issue_date), right, y, { size: 9 });
  y -= 14;
  text(inv.customer_name, MARGIN, y, { size: 11 });
  textRight('DUE', right - 150, y, { size: 8, font: bold, color: MUTED });
  textRight(fmtDate(inv.due_date), right, y, { size: 9 });
  y -= 14;
  if (inv.customer_email) text(inv.customer_email, MARGIN, y, { size: 9, color: MUTED });
  y -= 30;

  // Lines table
  const colDesc = MARGIN;
  const colQty = right - 210;
  const colUnit = right - 130;
  const colTotal = right;
  page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: right, y: y + 12 },
    thickness: 1,
    color: LINE,
  });
  text('DESCRIPTION', colDesc, y, { size: 8, font: bold, color: MUTED });
  textRight('QTY', colQty, y, { size: 8, font: bold, color: MUTED });
  textRight('UNIT', colUnit, y, { size: 8, font: bold, color: MUTED });
  textRight('AMOUNT', colTotal, y, { size: 8, font: bold, color: MUTED });
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 18;

  const lines = inv.lines ?? [];
  for (const l of lines) {
    text(l.description.slice(0, 60), colDesc, y, { size: 10 });
    textRight(String(l.quantity), colQty, y, { size: 10 });
    textRight(money(l.unit_price_minor, inv.currency), colUnit, y, { size: 10 });
    textRight(money(l.line_total_minor, inv.currency), colTotal, y, { size: 10 });
    y -= 18;
    if (y < 160) break; // one page only
  }

  y -= 6;
  page.drawLine({ start: { x: colUnit - 60, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 20;

  const totalRow = (label: string, value: string, strong = false) => {
    textRight(label, colUnit, y, {
      size: strong ? 11 : 9,
      font: strong ? bold : font,
      color: strong ? DARK : MUTED,
    });
    textRight(value, colTotal, y, { size: strong ? 11 : 10, font: strong ? bold : font });
    y -= strong ? 20 : 16;
  };

  totalRow('Subtotal', money(inv.subtotal_minor ?? inv.total_minor, inv.currency));
  if ((inv.discount_minor ?? 0) > 0) {
    totalRow('Discount', `- ${money(inv.discount_minor ?? 0, inv.currency)}`);
  }
  if ((inv.tax_minor ?? 0) > 0) {
    totalRow('Tax', money(inv.tax_minor ?? 0, inv.currency));
  }
  totalRow('Total', money(inv.total_minor, inv.currency), true);
  const paid = inv.total_minor - inv.balance_due_minor;
  if (paid > 0) totalRow('Paid', `- ${money(paid, inv.currency)}`);
  totalRow('Balance due', money(inv.balance_due_minor, inv.currency), true);

  // Footer
  text(
    `Invoice ${inv.number} · generated ${new Date().toISOString().slice(0, 10)}`,
    MARGIN,
    MARGIN,
    { size: 8, color: MUTED },
  );

  return doc.save();
}
