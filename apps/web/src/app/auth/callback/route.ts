import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors (e.g., invite rejection from auth hook)
  if (error) {
    const errorMessage = errorDescription || error;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorMessage)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    // Get session for auth token
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Failed to establish session")}`
      );
    }

    // Call bootstrap endpoint to ensure profile + membership exist
    try {
      const bootstrapRes = await fetch(`${API_BASE}/auth/bootstrap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!bootstrapRes.ok) {
        const errorData = await bootstrapRes.json().catch(() => ({ detail: "Bootstrap failed" }));
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(errorData.detail || "No valid invite found")}`
        );
      }

      // Bootstrap succeeded - now check membership role
      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("org_id", DEFAULT_ORG_ID)
        .single();

      if (!membership) {
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent("Membership not found after bootstrap")}`
        );
      }

      // Redirect to role dashboard
      const roleDashboards: Record<string, string> = {
        admin: "/admin",
        va: "/va",
        client: "/client",
      };
      const dashboard = roleDashboards[membership.role] || "/";
      return NextResponse.redirect(`${origin}${dashboard}`);
    } catch {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Bootstrap request failed")}`
      );
    }
  }

  // No code provided
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Authentication failed")}`
  );
}
