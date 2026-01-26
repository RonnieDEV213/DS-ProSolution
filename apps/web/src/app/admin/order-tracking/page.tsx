import { Suspense } from "react";
import { BookkeepingContent } from "@/components/bookkeeping/bookkeeping-content";

export default function AdminOrderTrackingPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading...</div>}>
      <BookkeepingContent />
    </Suspense>
  );
}
