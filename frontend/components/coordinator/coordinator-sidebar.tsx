"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getCurrentUser, logoutCoordinator } from "@/lib/api";
import {
  Heart,
  LayoutDashboard,
  GitCompareArrows,
  Users,
  FlaskConical,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    href: "/coordinator",
    icon: LayoutDashboard,
  },
  {
    label: "Matches",
    href: "/coordinator/matches",
    icon: GitCompareArrows,
  },
  {
    label: "Patients",
    href: "/coordinator/patients",
    icon: Users,
  },
  {
    label: "Trials Directory",
    href: "/coordinator/trials",
    icon: FlaskConical,
  },
  {
    label: "Outreach Inbox",
    href: "/coordinator/outreach",
    icon: MessageSquare,
  },
];

export function CoordinatorSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Coordinator");
  const [orgName, setOrgName] = useState("Hospital Organization");

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setDisplayName(user.username || "Coordinator");
        setOrgName(user.organization || "Hospital Organization");
      })
      .catch(() => {
        // Guard handles invalid sessions.
      });
  }, []);

  const onSignOut = () => {
    logoutCoordinator();
    router.replace("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar-background lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <Heart className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="text-base font-bold text-sidebar-primary-foreground">
          TrialBridge
        </span>
      </div>

      <div className="px-3 pt-2">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          Coordinator Portal
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/coordinator" &&
              pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <Link
          href="/coordinator/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" />
          Org Settings
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-sidebar-foreground">
              {displayName}
            </p>
            <p className="text-xs text-sidebar-foreground/50">
              {orgName}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
