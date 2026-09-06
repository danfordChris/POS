import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import { ApiError } from '@/lib/api';
import { Forbidden } from '@/components/shell/Forbidden';
import { Badge, Card, EmptyState, ErrorCard } from '@/components/ui';
import { AuthorizeWingerForm } from '@/components/wingers/AuthorizeWingerForm';
import { WingerStatusButton } from '@/components/wingers/WingerStatusButton';
import type { WingerAccount } from '@/lib/models';

export default async function WingersPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;

  let accounts: WingerAccount[];
  try {
    accounts = await tenantGet<WingerAccount[]>('/winger-accounts');
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 'unknown';
    const message = e instanceof ApiError ? e.message : 'Could not load winger accounts.';
    return <ErrorCard code={code} title={message} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-h2 font-bold">Wingers</h1>
        <p className="text-body text-text-secondary">
          Resellers you authorize see a read-only catalog with your winger prices. Set a per-product
          winger price or upload images on the{' '}
          <Link href="/catalog" className="text-accent font-semibold">
            catalog
          </Link>{' '}
          screen.
        </p>
      </div>

      <AuthorizeWingerForm />

      {accounts.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title="No resellers yet"
          description="Authorize someone by email or phone to give them catalog access."
        />
      ) : (
        <Card className="flex flex-col gap-1 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="text-caption text-text-secondary text-left">
                  <th className="px-4 py-3">Reseller</th>
                  <th className="px-4 py-3">Authorized</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t border-surface-sunken">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{a.name ?? a.email ?? a.user_id}</div>
                      {a.email && a.name ? (
                        <div className="text-caption text-text-secondary">{a.email}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={a.status === 'suspended' ? 'danger' : 'success'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <WingerStatusButton id={a.id} status={a.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
