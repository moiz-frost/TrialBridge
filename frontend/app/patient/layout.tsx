"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearPatientSession, getPatientSession } from "@/lib/patient-session";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [patientName, setPatientName] = useState<string | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);

  const isLoginPage = pathname === "/patient/login";
  const isIntakePage = pathname === "/patient/intake";
  useEffect(() => {
    const session = getPatientSession();
    setPatientName(session?.name || null);
    setSessionResolved(true);
  }, [pathname]);

  const onLogout = () => {
    clearPatientSession();
    setPatientName(null);
    router.replace("/patient/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">
              TrialBridge
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            {sessionResolved && !patientName && (
              <>
                {!isLoginPage && (
                  <Button asChild size="sm" className="h-8 px-3 text-xs">
                    <Link href="/patient/login">Login</Link>
                  </Button>
                )}
                {!isIntakePage && (
                  <Button asChild variant="outline" size="sm" className="h-8 px-3 text-xs">
                    <Link href="/patient/intake">Sign Up</Link>
                  </Button>
                )}
              </>
            )}
            {patientName && (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={onLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
