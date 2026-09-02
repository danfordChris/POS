import { Skeleton, SkeletonTable } from '@/components/ui';

export default function CatalogLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-40" />
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-11 w-56" />
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-48" />
      </div>
      <SkeletonTable rows={6} cols={4} />
    </div>
  );
}
