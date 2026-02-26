"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Send,
  Mail,
  Linkedin,
} from "lucide-react";

const mobileNavItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Prospects",
    href: "/prospects",
    icon: Users,
  },
  {
    label: "Campagnes",
    href: "/campaigns",
    icon: Send,
  },
  {
    label: "Emails",
    href: "/emails",
    icon: Mail,
  },
  {
    label: "LinkedIn",
    href: "/linkedin",
    icon: Linkedin,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t">
      <div className="flex items-center justify-around h-16">
        {mobileNavItems.map((item) => {
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
      </div>
    </nav>
  );
}
