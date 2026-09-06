'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, ErrorCard, TextField } from '@/components/ui';
import { saveAlertConfig, type AlertConfigState } from '@/app/(shell)/alerts/actions';
import type { AlertConfig } from '@/lib/models';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function AlertConfigForm({ initial }: { initial: AlertConfig }) {
  const [recipients, setRecipients] = useState<string[]>(
    initial.recipients.length ? initial.recipients : [''],
  );
  const [interval, setInterval] = useState(String(initial.min_interval_hours));
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<AlertConfigState, FormData>(saveAlertConfig, {});

  const filled = recipients.map((r) => r.trim()).filter(Boolean);
  const badEmail = filled.find((r) => !EMAIL_RE.test(r));
  const badInterval = !/^\d+$/.test(interval.trim()) || Number(interval) < 1;

  function setAt(i: number, value: string) {
    setRecipients((rs) => rs.map((r, j) => (j === i ? value : r)));
  }

  return (
    <Card className="flex flex-col gap-5">
      <form
        action={action}
        onSubmit={(e) => {
          if (badInterval) {
            e.preventDefault();
            setClientError('Interval must be a whole number of hours, at least 1.');
          } else if (badEmail) {
            e.preventDefault();
            setClientError(`Not a valid email: ${badEmail}`);
          } else {
            setClientError(null);
          }
        }}
        className="flex flex-col gap-5"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="text-caption font-semibold text-text-secondary">Recipients</legend>
          {recipients.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextField
                name="recipients"
                type="email"
                inputMode="email"
                placeholder="owner@business.co.tz"
                value={value}
                onChange={(e) => setAt(i, e.target.value)}
                className="flex-1"
                aria-label={`Recipient ${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove recipient ${i + 1}`}
                onClick={() =>
                  setRecipients((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : ['']))
                }
              >
                <Trash2 size={16} strokeWidth={2} />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRecipients((rs) => [...rs, ''])}
            >
              <Plus size={16} strokeWidth={2} /> Add recipient
            </Button>
          </div>
          <p className="text-caption text-text-secondary">
            {filled.length === 0
              ? 'Empty — the digest goes to every active Owner.'
              : 'Only these addresses receive the digest.'}
          </p>
        </fieldset>

        <TextField
          label="Minimum hours between emails"
          name="min_interval_hours"
          type="number"
          inputMode="numeric"
          min={1}
          required
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          hint="At most one digest per business in this window (default 24)."
        />

        {clientError ? (
          <ErrorCard code="validation_error" title={clientError} />
        ) : state.error ? (
          <ErrorCard code={state.error.code} title={state.error.message} />
        ) : state.ok ? (
          <p className="text-caption text-success">Alert settings saved.</p>
        ) : null}

        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
