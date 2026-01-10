import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that don't require authentication
const publicRoutes = ["/login", "/auth/callback"];

// Role to dashboard mapping
const roleDashboards: Record<string, string> = {
  admin: "/admin",
  va: "/va",
  client: "/client",
};

export async function middleware(request: NextRequest) {
  // DEBUG: Remove after confirming middleware runs
  console.log("[middleware] path:", request.nextUrl.pathname);

  const { supabaseResponse, user, supabase } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    // If logged in and accessing login, redirect to appropriate dashboard
    if (user && pathname === "/login") {
      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (membership?.role) {
        const dashboard = roleDashboards[membership.role] || "/admin";
        return NextResponse.redirect(new URL(dashboard, request.url));
      }
    }
    return supabaseResponse;
  }

  // Require auth for all other routes
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Fetch user's role for protected routes
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .single();

  // No membership = redirect to login with error
  if (!membership) {
    return NextResponse.redirect(
      new URL(
        "/login?error=" +
          encodeURIComponent("Account setup incomplete. Please contact an administrator."),
        request.url
      )
    );
  }

  const userRole = membership.role;

  // Role-based route protection
  if (pathname.startsWith("/admin") && userRole !== "admin") {
    return NextResponse.redirect(
      new URL(roleDashboards[userRole] || "/", request.url)
    );
  }
  if (pathname.startsWith("/va") && userRole !== "va") {
    return NextResponse.redirect(
      new URL(roleDashboards[userRole] || "/", request.url)
    );
  }
  if (pathname.startsWith("/client") && userRole !== "client") {
    return NextResponse.redirect(
      new URL(roleDashboards[userRole] || "/", request.url)
    );
  }

  // Redirect root to role-specific dashboard
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(roleDashboards[userRole] || "/admin", request.url)
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images and other static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
