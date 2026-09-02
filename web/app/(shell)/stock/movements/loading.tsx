import { Skeleton, SkeletonTable } from '@/components/ui';

export default function MovementsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-52" />
      <div className="flex gap-4">
        <Skeleton className="h-11 w-44" />
        <Skeleton className="h-11 w-40" />
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
