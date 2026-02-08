import React from "react"
import { CoordinatorSidebar } from "@/components/coordinator/coordinator-sidebar";
import { CoordinatorMobileHeader } from "@/components/coordinator/coordinator-mobile-header";
import { CoordinatorAuthGuard } from "@/components/auth/coordinator-auth-guard";

export default function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CoordinatorAuthGuard>
      <div className="min-h-screen bg-background" suppressHydrationWarning>
        <CoordinatorSidebar />
        <CoordinatorMobileHeader />
        <main className="lg:pl-64">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </CoordinatorAuthGuard>
  );
}
