import { Skeleton } from '@/components/ui';

export default function WingersLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
