"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function SetupPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Setup Not Required</CardTitle>
          <CardDescription className="text-gray-400">
            Your account is ready to use
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-900/30 border border-blue-700 p-4">
            <p className="text-sm text-blue-200">
              Access is now based on your assigned roles. If you need additional
              access, ask an administrator to assign the appropriate roles.
            </p>
          </div>

          <div className="text-sm text-gray-400">
            <p className="mb-2">
              Use the dashboard to get started. Your available tools will
              expand as roles are assigned.
            </p>
            <p>
              If you believe this is an error or need urgent access, please
              contact your administrator.
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
