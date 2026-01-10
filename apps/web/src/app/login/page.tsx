import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

function LoginFormFallback() {
  return (
    <div className="space-y-6">
      <div className="w-full h-12 bg-gray-800 rounded-lg animate-pulse" />
      <p className="text-center text-sm text-gray-500">
        Only invited users can sign in
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">DS-ProSolution</h1>
          <p className="mt-2 text-gray-400">Sign in to access your dashboard</p>
        </div>
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
