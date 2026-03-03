"use client";

import { useRouter, usePathname } from "next/navigation";
import { Mail, Menu, Settings, LogOut, Shield } from "lucide-react";
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

interface HeaderProps {
  title: string;
  user?: {
    email?: string;
    full_name?: string;
    avatar_url?: string;
    role?: "super_admin" | "user";
  };
  onMenuToggle?: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/prospects": "Prospects",
  "/campaigns": "Campagnes",
  "/emails": "Emails envoyes",
  "/deals": "Pipeline",
  "/inbox": "Inbox",
  "/linkedin": "LinkedIn",
  "/agents": "Agents IA",
  "/settings": "Parametres",
  "/admin": "Administration",
  "/activities": "Activites",
  "/automation": "Automation",
  "/scraper": "Scraper",
  "/maps-scraper": "Google Maps",
  "/onboarding": "Onboarding",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match sub-routes like /campaigns/[id]
  const base = "/" + pathname.split("/")[1];
  return PAGE_TITLES[base] || "ColdReach";
}

export function Header({ title, user, onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const pageTitle = getPageTitle(pathname);

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
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="size-5" />
          <span className="sr-only">Menu</span>
        </Button>

        {/* Page title */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
