"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Mail, Settings, LogOut, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { PAGE_TITLES } from "@/lib/constants";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

interface HeaderProps {
  user?: {
    email?: string;
    full_name?: string;
    avatar_url?: string;
    role?: "super_admin" | "user";
  };
}

/**
 * Resolve page title and optional breadcrumb from pathname.
 * Returns { title, breadcrumb? } where breadcrumb is the parent label + href.
 */
function resolvePageInfo(pathname: string): {
  title: string;
  breadcrumb?: { label: string; href: string };
} {
  // Exact match first (includes sub-routes like /campaigns/new)
  if (PAGE_TITLES[pathname]) {
    // Check if this is a known sub-route (has more than 1 segment after /)
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const parentPath = "/" + segments[0];
      const parentTitle = PAGE_TITLES[parentPath];
      if (parentTitle) {
        return {
          title: PAGE_TITLES[pathname],
          breadcrumb: { label: parentTitle, href: parentPath },
        };
      }
    }
    return { title: PAGE_TITLES[pathname] };
  }

  // Dynamic sub-routes: /campaigns/[id]/edit, /campaigns/[id], etc.
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 3) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment === "edit") {
      const parentPath = "/" + segments[0];
      const parentTitle = PAGE_TITLES[parentPath];
      if (parentTitle) {
        return {
          title: `Modifier`,
          breadcrumb: { label: parentTitle, href: parentPath },
        };
      }
    }
  }

  // 2-segment dynamic route: /campaigns/[id], /deals/[id], etc.
  if (segments.length >= 2) {
    const parentPath = "/" + segments[0];
    const parentTitle = PAGE_TITLES[parentPath];
    if (parentTitle) {
      return {
        title: parentTitle,
        breadcrumb: { label: parentTitle, href: parentPath },
      };
    }
  }

  // Fallback: base path
  const base = "/" + (segments[0] || "");
  return { title: PAGE_TITLES[base] || "ColdReach" };
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { title, breadcrumb } = resolvePageInfo(pathname);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const userInitials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "U";

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-white border-b shrink-0">
      <div className="flex items-center gap-3">
        {/* Page title with breadcrumb */}
        <div className="flex items-center gap-1.5">
          {breadcrumb && (
            <>
              <Link
                href={breadcrumb.href}
                className="text-sm text-muted-foreground hover:text-slate-700 transition-colors hidden sm:inline"
              >
                {breadcrumb.label}
              </Link>
              <ChevronRight className="size-3.5 text-muted-foreground hidden sm:inline" />
            </>
          )}
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Global Search */}
        <GlobalSearch />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full p-0"
            >
              <Avatar size="sm">
                {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
                <AvatarFallback className="text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar size="sm">
                {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
                <AvatarFallback className="text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <p className="text-sm font-medium">
                  {user?.full_name ?? "Utilisateur"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email ?? ""}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/inbox")}>
                <Mail className="size-4" />
                Inbox
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="size-4" />
                Parametres
              </DropdownMenuItem>
              {user?.role === "super_admin" && (
                <DropdownMenuItem onClick={() => router.push("/admin")}>
                  <Shield className="size-4" />
                  Administration
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="size-4" />
              Se deconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
