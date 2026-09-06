import { Skeleton } from '@/components/ui';

export default function AlertsLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
