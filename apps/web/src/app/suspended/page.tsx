"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function SuspendedPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-md space-y-8 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Account Suspended</h1>
          <p className="mt-4 text-gray-400">
            Your account has been suspended. You no longer have access to this
            application.
          </p>
          <p className="mt-2 text-gray-500 text-sm">
            If you believe this is a mistake, please contact an administrator.
          </p>
        </div>

        <Button
          onClick={handleSignOut}
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
