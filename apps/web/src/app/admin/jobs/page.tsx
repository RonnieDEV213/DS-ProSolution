"use client";

import { useState } from "react";
import { JobsTable } from "@/components/admin/automation/jobs-table";
import { PageHeader } from "@/components/layout/page-header";

export default function JobsPage() {
  const [refreshTrigger] = useState(0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Jobs"
        description="Monitor automation job status and execution history."
      />
      <JobsTable refreshTrigger={refreshTrigger} />
    </div>
  );
}
