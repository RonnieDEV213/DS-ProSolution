"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface AccessCodeInfo {
  prefix: string;
  created_at: string;
  expires_at: string;
  rotated_at: string | null;
}

interface GenerateResponse {
  prefix: string;
  full_code: string;
  expires_at: string;
}

type CodeState = "loading" | "no-code" | "has-code";

export function AccessCodeDisplay() {
  const [codeState, setCodeState] = useState<CodeState>("loading");
  const [codeInfo, setCodeInfo] = useState<AccessCodeInfo | null>(null);
  const [newlyGeneratedCode, setNewlyGeneratedCode] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [customSecretOpen, setCustomSecretOpen] = useState(false);
  const [customSecret, setCustomSecret] = useState("");
  const [customSecretError, setCustomSecretError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Fetch access code info on mount
  const fetchCodeInfo = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setCodeState("no-code");
        return;
      }

      const res = await fetch(`${API_BASE}/access-codes/me`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.status === 404) {
        setCodeState("no-code");
        setCodeInfo(null);
        return;
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to load access code" }));
        throw new Error(error.detail || "Failed to load access code");
      }

      const data: AccessCodeInfo = await res.json();
      setCodeInfo(data);
      setCodeState("has-code");
    } catch (err) {
      console.error("Failed to fetch access code:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load access code");
      setCodeState("no-code");
    }
  }, []);

  useEffect(() => {
    fetchCodeInfo();
  }, [fetchCodeInfo]);

  // Handle window blur to clear revealed state
  useEffect(() => {
    const handleBlur = () => setIsRevealed(false);
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  // Clear newly generated code when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      setNewlyGeneratedCode(null);
    };
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/access-codes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to generate access code" }));
        throw new Error(error.detail || "Failed to generate access code");
      }

      const data: GenerateResponse = await res.json();
      setCodeInfo({
        prefix: data.prefix,
        created_at: new Date().toISOString(),
        expires_at: data.expires_at,
        rotated_at: null,
      });
      setNewlyGeneratedCode(data.full_code);
      setCodeState("has-code");
      toast.success("Access code generated! Copy it now - the secret won't be shown again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate access code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRotate = async (customSecretValue?: string) => {
    setIsRotating(true);
    setRotateConfirmOpen(false);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const body = customSecretValue ? { custom_secret: customSecretValue } : undefined;

      const res = await fetch(`${API_BASE}/access-codes/rotate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to rotate access code" }));
        if (error.detail?.errors) {
          throw new Error(error.detail.errors.join(", "));
        }
        throw new Error(error.detail || "Failed to rotate access code");
      }

      const data: GenerateResponse = await res.json();
      setCodeInfo((prev) =>
        prev
          ? {
              ...prev,
              rotated_at: new Date().toISOString(),
              expires_at: data.expires_at,
            }
          : null
      );
      setNewlyGeneratedCode(data.full_code);
      setCustomSecretOpen(false);
      setCustomSecret("");
      setCustomSecretError(null);
      toast.success("Access code rotated! Copy your new code - the secret won't be shown again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rotate access code");
    } finally {
      setIsRotating(false);
    }
  };

  const handleCopy = async () => {
    if (!codeInfo) return;

    // Only copy the full code if newly generated, otherwise just copy prefix
    if (newlyGeneratedCode) {
      try {
        await navigator.clipboard.writeText(newlyGeneratedCode);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Failed to copy to clipboard");
      }
    } else {
      try {
        await navigator.clipboard.writeText(codeInfo.prefix);
        toast.info("Prefix copied. Rotate your code to get a copyable full code.");
      } catch {
        toast.error("Failed to copy to clipboard");
      }
    }
  };

  const validateCustomSecret = (value: string): string | null => {
    if (value.length < 8) {
      return "Secret must be at least 8 characters";
    }
    if (value.length > 32) {
      return "Secret must be at most 32 characters";
    }
    if (!/^[a-zA-Z0-9]+$/.test(value)) {
      return "Secret must be alphanumeric only";
    }
    return null;
  };

  const handleCustomSecretChange = (value: string) => {
    setCustomSecret(value);
    if (value) {
      setCustomSecretError(validateCustomSecret(value));
    } else {
      setCustomSecretError(null);
    }
  };

  const handleSaveCustomSecret = () => {
    const error = validateCustomSecret(customSecret);
    if (error) {
      setCustomSecretError(error);
      return;
    }
    handleRotate(customSecret);
  };

  // Hold-to-reveal handlers
  const handlePointerDown = () => setIsRevealed(true);
  const handlePointerUp = () => setIsRevealed(false);
  const handlePointerLeave = () => setIsRevealed(false);

  // Get display text for the code
  const getDisplayCode = (): string => {
    const prefix = codeInfo?.prefix || "????";
    if (newlyGeneratedCode) {
      return isRevealed ? newlyGeneratedCode : `${prefix}-${"*".repeat(12)}`;
    }
    return `${prefix}-${"*".repeat(12)}`;
  };

  if (codeState === "loading") {
    return (
      <div className="space-y-4">
        <Label className="text-gray-400">Access Code</Label>
        <div className="h-10 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (codeState === "no-code") {
    return (
      <div className="space-y-4">
        <Label className="text-gray-400">Access Code</Label>
        <p className="text-sm text-gray-500">
          Generate an access code to authenticate the browser extension.
        </p>
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating..." : "Generate Access Code"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="text-gray-400">Access Code</Label>

      {/* Code display */}
      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-lg bg-gray-800 px-4 py-2 rounded border border-gray-700">
          {getDisplayCode()}
        </div>

        {/* Hold to reveal button */}
        {newlyGeneratedCode ? (
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerUp}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  isRevealed
                    ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                }
              />
            </svg>
          </Button>
        ) : null}

        {/* Copy button */}
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700"
          onClick={handleCopy}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </Button>
      </div>

      {/* Hint for existing codes */}
      {!newlyGeneratedCode && (
        <p className="text-xs text-gray-500">
          The secret cannot be revealed for existing codes. Rotate to get a new code you can copy.
        </p>
      )}

      {/* Newly generated code hint */}
      {newlyGeneratedCode && (
        <p className="text-xs text-amber-400">
          Copy your code now! Once you close this dialog, the secret will be hidden.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700"
          onClick={() => setRotateConfirmOpen(true)}
          disabled={isRotating}
        >
          {isRotating ? "Rotating..." : "Rotate Code"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-gray-400 hover:text-white",
            customSecretOpen && "bg-gray-800"
          )}
          onClick={() => setCustomSecretOpen(!customSecretOpen)}
        >
          Use custom secret
        </Button>
      </div>

      {/* Custom secret section */}
      {customSecretOpen && (
        <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="space-y-2">
            <Label htmlFor="custom-secret" className="text-sm">
              Custom Secret
            </Label>
            <Input
              id="custom-secret"
              type="text"
              value={customSecret}
              onChange={(e) => handleCustomSecretChange(e.target.value)}
              placeholder="Enter 8-32 alphanumeric characters"
              className={cn(
                "bg-gray-900 border-gray-700",
                customSecretError && "border-red-500"
              )}
            />
            {customSecretError && (
              <p className="text-xs text-red-400">{customSecretError}</p>
            )}
            <p className="text-xs text-gray-500">
              8-32 characters, letters and numbers only.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSaveCustomSecret}
            disabled={!customSecret || !!customSecretError || isRotating}
          >
            {isRotating ? "Saving..." : "Save Custom Secret"}
          </Button>
        </div>
      )}

      {/* Rotate confirmation dialog */}
      <AlertDialog open={rotateConfirmOpen} onOpenChange={setRotateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate Access Code</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new secret. Your current code will stop working immediately.
              The extension will need to re-authenticate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleRotate()} disabled={isRotating}>
              {isRotating ? "Rotating..." : "Rotate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
