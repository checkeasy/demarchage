"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  MoreHorizontal,
  Send,
  Mail,
  Inbox,
  Linkedin,
  Bot,
  Search,
  MapPin,
  Brain,
  Settings,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const primaryNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pipeline", href: "/deals", icon: Kanban },
  { label: "Prospects", href: "/prospects", icon: Users },
  { label: "Activites", href: "/activities", icon: CheckSquare },
];

const moreNavItems = [
  { label: "Campagnes", href: "/campaigns", icon: Send },
  { label: "Emails", href: "/emails", icon: Mail },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "LinkedIn", href: "/linkedin", icon: Linkedin },
  { label: "Automation", href: "/automation", icon: Bot },
  { label: "Scraper", href: "/scraper", icon: Search },
  { label: "Google Maps", href: "/maps-scraper", icon: MapPin },
  { label: "Agents IA", href: "/agents", icon: Brain },
  { label: "Parametres", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isMoreActive = moreNavItems.some(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t">
        <div className="flex items-center justify-around h-16">
          {primaryNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                  isActive
                    ? "text-blue-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className="size-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* More menu trigger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                  isMoreActive
                    ? "text-blue-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <MoreHorizontal className="size-5" />
                <span className="text-[10px] font-medium">Plus</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-4 gap-3 py-4">
                {moreNavItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="size-5" />
                      <span className="text-[10px] font-medium text-center leading-tight">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}
