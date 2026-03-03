"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { NAV_ITEMS, ADMIN_NAV_ITEM, NAV_GROUP_ORDER, type NavGroup } from "@/lib/constants";

interface SidebarProps {
  user?: {
    email?: string;
    full_name?: string;
    avatar_url?: string;
    role?: "super_admin" | "user";
  };
  counts?: {
    campaigns?: number;
    prospects?: number;
    activities?: number;
    deals?: number;
  };
}

interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group: NavGroup;
  badgeCount?: number;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

export function Sidebar({ user, counts }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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

  // Map href to badge counts
  const countMap: Record<string, number | undefined> = {
    "/campaigns": counts?.campaigns,
    "/prospects": counts?.prospects,
    "/activities": counts?.activities,
    "/deals": counts?.deals,
  };

  const allItems: SidebarNavItem[] = [
    ...NAV_ITEMS.map((item) => ({
      ...item,
      badgeCount: countMap[item.href],
      badgeVariant: "secondary" as const,
    })),
    ...(user?.role === "super_admin" ? [ADMIN_NAV_ITEM] : []),
  ];

  // Group items
  const groupedItems = NAV_GROUP_ORDER
    .map((group) => ({
      group,
      items: allItems.filter((item) => item.group === group),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <TooltipProvider>
      <aside
        className={`hidden md:flex flex-col bg-slate-900 text-white transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Workspace Switcher */}
        <WorkspaceSwitcher collapsed={collapsed} />

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {groupedItems.map((group, groupIndex) => (
            <div key={group.group}>
              {groupIndex > 0 && (
                <Separator className="bg-slate-700/50 my-2 mx-1" />
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  const linkContent = (
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      } ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon className="size-5 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.badgeCount !== undefined &&
                            item.badgeCount > 0 && (
                              <Badge
                                variant={item.badgeVariant ?? "default"}
                                className="h-5 min-w-5 text-[10px] px-1.5"
                              >
                                {item.badgeCount}
                              </Badge>
                            )}
                        </>
                      )}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right">
                          <span>{item.label}</span>
                          {item.badgeCount !== undefined &&
                            item.badgeCount > 0 && (
                              <Badge
                                variant={item.badgeVariant ?? "default"}
                                className="ml-2 h-5 min-w-5 text-[10px] px-1.5"
                              >
                                {item.badgeCount}
                              </Badge>
                            )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return <div key={item.href}>{linkContent}</div>;
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="px-2">
          <Separator className="bg-slate-700/50" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full mt-2 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="size-4" />
                <span className="ml-2">Reduire</span>
              </>
            )}
          </Button>
        </div>

        {/* User Section */}
        <div className="p-3 border-t border-slate-700/50">
          <div
            className={`flex items-center gap-3 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Avatar size="sm">
              {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="bg-slate-700 text-slate-200 text-xs">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.full_name ?? "Utilisateur"}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user?.email ?? ""}
                </p>
              </div>
            )}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-red-400 hover:bg-slate-800"
                    aria-label="Se deconnecter"
                  >
                    <LogOut className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Se deconnecter</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 hover:bg-slate-800"
                aria-label="Se deconnecter"
              >
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
