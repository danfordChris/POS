'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  ErrorCard,
  Panel,
  SegmentedControl,
  TextField,
  ThemeToggle,
  Toggle,
  Well,
} from '@/components/ui';

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'staff', label: 'Staff' },
  { value: 'winger', label: 'Winger' },
] as const;

export default function DesignSystemPage() {
  const [role, setRole] = useState<(typeof ROLES)[number]['value']>('owner');
  const [alerts, setAlerts] = useState(true);
  const [sku, setSku] = useState('');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-overline uppercase tracking-wide text-text-secondary">Duka Stock</p>
          <h1 className="text-h1 font-bold">Neumorphic design system</h1>
          <p className="text-body text-text-secondary mt-1">
            Tokens and components wired. Screens are built from these — not from the handoff
            mockups.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Panel title="Buttons" subtitle="Press to see the raised → inset sink">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Record sale</Button>
            <Button variant="secondary">Add product</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Void</Button>
            <Button variant="icon" aria-label="More">
              ⋯
            </Button>
          </div>
        </Panel>

        <Panel title="Inputs" subtitle="Inset wells on the sunken surface">
          <div className="flex flex-col gap-4">
            <TextField
              label="SKU"
              placeholder="SODA-300"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              hint="Unique per business"
            />
            <TextField
              label="Sell price"
              placeholder="0"
              leading="TZS"
              inputMode="numeric"
              error={sku === '0' ? 'Price must be greater than zero' : undefined}
            />
            <div className="flex items-center justify-between">
              <span className="text-body">Low-stock alerts</span>
              <Toggle checked={alerts} onChange={setAlerts} label="Low-stock alerts" />
            </div>
          </div>
        </Panel>

        <Panel title="Segmented control" subtitle="Active option reads as raised">
          <SegmentedControl
            aria-label="Role preview"
            options={ROLES}
            value={role}
            onChange={setRole}
          />
          <p className="text-caption text-text-secondary mt-3">
            Role-gated regions unmount — current: <strong>{role}</strong>
          </p>
        </Panel>

        <Panel title="Surfaces">
          <div className="flex flex-col gap-4">
            <Card className="text-body">Raised card — elevation md</Card>
            <Well className="text-body">Sunken well — inset</Well>
          </div>
        </Panel>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 font-semibold">Error by code</h2>
        <ErrorCard
          code="insufficient_stock"
          title="Not enough stock to complete this sale"
          body="Two lines exceed the quantity on hand. Adjust the quantities and try again."
          action={{ label: 'Review lines', onClick: () => undefined }}
        />
      </section>
    </main>
  );
}
