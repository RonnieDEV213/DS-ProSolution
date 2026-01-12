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
          <CardTitle className="text-2xl">Account Pending</CardTitle>
          <CardDescription className="text-gray-400">
            Your account is awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-900/30 border border-amber-700 p-4">
            <p className="text-sm text-amber-200">
              Your account has been created successfully. An administrator will
              review and activate your account shortly.
            </p>
          </div>

          <div className="text-sm text-gray-400">
            <p className="mb-2">
              Once your account is activated, you will be able to access the
              application. You can try signing in again later to check your
              status.
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
