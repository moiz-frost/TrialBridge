"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logoutCoordinator } from "@/lib/api";
import {
  Menu,
  Heart,
  LayoutDashboard,
  GitCompareArrows,
  Users,
  FlaskConical,
  MessageSquare,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/coordinator", icon: LayoutDashboard },
  { label: "Matches", href: "/coordinator/matches", icon: GitCompareArrows },
  { label: "Patients", href: "/coordinator/patients", icon: Users },
  { label: "Trials Directory", href: "/coordinator/trials", icon: FlaskConical },
  { label: "Outreach Inbox", href: "/coordinator/outreach", icon: MessageSquare },
  { label: "Org Settings", href: "/coordinator/settings", icon: Settings },
];

export function CoordinatorMobileHeader() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Heart className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-base font-bold text-foreground">TrialBridge</span>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open navigation</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar-background p-0">
          <SheetTitle className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <Heart className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="text-base font-bold text-sidebar-primary-foreground">
              TrialBridge
            </span>
          </SheetTitle>
          <nav className="mt-4 space-y-1 px-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                logoutCoordinator();
                setOpen(false);
                router.replace("/login");
              }}
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Sign Out
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
