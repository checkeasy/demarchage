import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth (no register - signup disabled)
  const publicRoutes = ["/", "/auth/login", "/auth/callback", "/auth/confirm"];
  const isPublicRoute = publicRoutes.includes(pathname);
  const isApiRoute = pathname.startsWith("/api/");
  const isTrackingRoute = pathname.startsWith("/api/tracking/");
  const isWebhookRoute = pathname.startsWith("/api/webhooks/");

  // Block register page - redirect to login
  if (pathname === "/auth/register") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Allow public routes, API routes, tracking and webhook routes
  if (isPublicRoute || isTrackingRoute || isWebhookRoute) {
    return supabaseResponse;
  }

  // Allow API routes (they handle their own auth)
  if (isApiRoute) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && pathname.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // For protected routes: check profile role and is_active
  if (user && !isPublicRoute && !isApiRoute && !isTrackingRoute && !isWebhookRoute) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (serviceRoleKey && supabaseUrl) {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?select=role,is_active&id=eq.${user.id}`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              Accept: "application/json",
            },
          }
        );

        if (res.ok) {
          const profiles = await res.json();
          const profile = profiles?.[0];

          // Inactive users: sign out and redirect
          if (!profile || profile.is_active === false) {
            await supabase.auth.signOut();
            const url = request.nextUrl.clone();
            url.pathname = "/auth/login";
            url.searchParams.set("error", "account_disabled");
            return NextResponse.redirect(url);
          }

          // Block /admin routes for non-super_admin
          if (pathname.startsWith("/admin") && profile.role !== "super_admin") {
            const url = request.nextUrl.clone();
            url.pathname = "/dashboard";
            return NextResponse.redirect(url);
          }
        }
      } catch {
        // If profile check fails, allow through (fail open for non-admin routes)
        if (pathname.startsWith("/admin")) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
