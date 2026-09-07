import { Download } from 'lucide-react';
import { getSession } from '@/lib/session';
import { Forbidden } from '@/components/shell/Forbidden';
import { Card } from '@/components/ui';

export default async function SettingsPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-h2 font-bold">Settings</h1>
        <p className="text-body text-text-secondary">
          Business name, currency, locale and timezone editing is coming soon.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-h3 font-semibold">Export business data</h2>
          <p className="text-caption text-text-secondary">
            Download this business&rsquo;s products, categories, stock levels, sales (with lines)
            and reseller accounts as a JSON file. Owner only.
          </p>
        </div>
        <a
          href="/settings/export"
          className="inline-flex w-fit items-center gap-2 rounded-control bg-surface-sunken px-4 py-2 text-body font-semibold text-accent shadow-elev-inset"
        >
          <Download size={18} />
          Download export (.json)
        </a>
      </Card>
    </div>
  );
}
