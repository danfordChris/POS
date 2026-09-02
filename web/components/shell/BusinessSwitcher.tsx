'use client';

import { useState } from 'react';
import { ChevronDown, Store } from 'lucide-react';

/**
 * Shows the active business. Switching between businesses needs a
 * "list my memberships" endpoint that the API does not expose yet
 * (see docs/implementation/status), so the menu is informational for now.
 */
export function BusinessSwitcher({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-control bg-surface px-3 py-2 text-body font-semibold shadow-elev-sm active:shadow-elev-inset"
      >
        <Store size={18} strokeWidth={2} />
        <span className="max-w-[40vw] truncate">{businessName}</span>
        <ChevronDown size={16} strokeWidth={2} className="text-text-secondary" />
      </button>
      {open ? (
        <div className="absolute left-0 mt-2 w-64 rounded-card bg-surface p-3 text-caption text-text-secondary shadow-elev-lg">
          Multi-business switching arrives with the memberships list endpoint.
        </div>
      ) : null}
    </div>
  );
}
