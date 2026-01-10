import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    // Get user and their membership to determine redirect
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (membership?.role) {
        const roleDashboards: Record<string, string> = {
          admin: "/admin",
          va: "/va",
          client: "/client",
        };
        const dashboard = roleDashboards[membership.role] || "/";
        return NextResponse.redirect(`${origin}${dashboard}`);
      }
    }

    // Fallback: no membership found (edge case)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Account setup incomplete. Please contact an administrator.")}`
    );
  }

  // No code provided
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Authentication failed")}`
  );
}
