"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ExtensionTabProps {
  role: string;
}

// TODO: Replace with actual Chrome Web Store URL when extension is published
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "#";

export function ExtensionTab({ role }: ExtensionTabProps) {
  const showAccessCode = role === "admin" || role === "va";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-foreground">Download Extension</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Install the browser extension to enable automation features.
        </p>
      </div>

      <Button asChild className="w-full sm:w-auto">
        <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download Extension
        </a>
      </Button>

      {/* Installation Steps */}
      <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
        <Label className="text-foreground">Installation Steps</Label>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">
              1
            </span>
            <span>Click the download button above to go to the Chrome Web Store</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">
              2
            </span>
            <span>Click &quot;Add to Chrome&quot; and confirm the installation</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">
              3
            </span>
            <span>
              {showAccessCode
                ? "Use your access code from Security tab to authenticate"
                : "Follow the pairing instructions in the extension"}
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
