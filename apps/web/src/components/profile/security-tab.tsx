"use client";

import { AccessCodeDisplay } from "./access-code-display";

export function SecurityTab() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-foreground">Access Code</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Use this code to authenticate the browser extension.
        </p>
      </div>

      <AccessCodeDisplay />
    </div>
  );
}
