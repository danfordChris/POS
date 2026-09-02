import { Skeleton, SkeletonTable } from '@/components/ui';

export default function StockLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-32" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <SkeletonTable rows={6} cols={4} />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
