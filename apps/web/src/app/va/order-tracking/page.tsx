import { Suspense } from "react";
import { BookkeepingContent } from "@/components/bookkeeping/bookkeeping-content";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function VAOrderTrackingPage() {
  return (
    <Suspense fallback={<TableSkeleton columns={5} rows={10} />}>
      <BookkeepingContent />
    </Suspense>
  );
}
