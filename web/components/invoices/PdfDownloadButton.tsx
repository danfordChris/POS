'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

/**
 * The public invoice PDF (`/v1/i/{token}/pdf`) is 302 → object once the media
 * service has rendered it, and `202` while that is still in flight. This polls
 * the URL and opens it in a new tab when ready.
 */
export function PdfDownloadButton({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'checking' | 'pending' | 'error'>('idle');

  async function open() {
    setState('checking');
    for (let i = 0; i < 8; i += 1) {
      try {
        const res = await fetch(url, { method: 'GET', redirect: 'follow' });
        if (res.ok && res.headers.get('content-type')?.includes('pdf')) {
          window.open(url, '_blank', 'noopener');
          setState('idle');
          return;
        }
        if (res.status === 202) {
          setState('pending');
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setState('error');
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={open}
        disabled={state === 'checking' || state === 'pending'}
      >
        {state === 'pending' ? 'Generating…' : state === 'checking' ? 'Opening…' : 'Download PDF'}
      </Button>
      {state === 'error' ? (
        <span className="text-caption text-danger">Not ready yet — try again shortly.</span>
      ) : null}
    </div>
  );
}
