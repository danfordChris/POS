'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';
import { tenantSend } from '@/lib/tenant-api';
import type { AlertConfig } from '@/lib/models';

export interface AlertConfigState {
  ok?: boolean;
  error?: { code: string; message: string };
  config?: AlertConfig;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function saveAlertConfig(
  _prev: AlertConfigState,
  fd: FormData,
): Promise<AlertConfigState> {
  const recipients = fd
    .getAll('recipients')
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v !== '');
  const minInterval = Number(fd.get('min_interval_hours'));

  // Mirror the API's rules so an obvious mistake never round-trips.
  if (!Number.isInteger(minInterval) || minInterval < 1) {
    return {
      error: {
        code: 'validation_error',
        message: 'Interval must be a whole number of hours, at least 1.',
      },
    };
  }
  const bad = recipients.find((r) => !EMAIL_RE.test(r));
  if (bad) {
    return {
      error: { code: 'validation_error', message: `Not a valid email: ${bad}` },
    };
  }

  let config: AlertConfig;
  try {
    config = await tenantSend<AlertConfig>('PUT', '/alert-config', {
      recipients,
      min_interval_hours: minInterval,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return { error: { code: e.code, message: e.message } };
    }
    throw e;
  }

  revalidatePath('/alerts');
  return { ok: true, config };
}
