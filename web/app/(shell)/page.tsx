import { getSession } from '@/lib/session';
import { Card } from '@/components/ui';

const KPIS = [
  { label: "Today's sales", value: '—' },
  { label: 'Items low on stock', value: '—' },
  { label: 'Stock value', value: '—' },
];

export default async function DashboardPage() {
  const session = await getSession();
  const name = session?.user.name ?? '';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">Dashboard</h1>
        <p className="text-body text-text-secondary mt-1">
          Welcome back{name ? `, ${name.split(' ')[0]}` : ''}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {KPIS.map((k) => (
          <Card key={k.label} className="flex flex-col gap-1">
            <span className="text-caption text-text-secondary">{k.label}</span>
            <span className="text-h1 font-bold tnum">{k.value}</span>
          </Card>
        ))}
      </div>

      <Card>
        <p className="text-body text-text-secondary">
          Live figures arrive with the catalog, stock, and sales screens (T-0106–T-0109).
          Navigation, roles, and your session are ready now.
        </p>
      </Card>
    </div>
  );
}
