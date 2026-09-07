import { z } from 'zod';
import { EVENT_PAYLOADS } from '@pos/contracts';

/** The slice of `sales.InvoiceIssued` the media service renders + retains. */
export const invoiceSnapshotSchema = EVENT_PAYLOADS.InvoiceIssued;

export type InvoiceSnapshot = z.infer<typeof invoiceSnapshotSchema>;
