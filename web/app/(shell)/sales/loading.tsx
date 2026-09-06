import { Skeleton, SkeletonTable } from '@/components/ui';

export default function SalesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-28" />
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
