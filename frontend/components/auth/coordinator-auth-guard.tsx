"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getCurrentUser } from "@/lib/api";
import { clearAuthTokens, hasAuthToken } from "@/lib/auth";

export function CoordinatorAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const redirectToLogin = () => {
      const next = encodeURIComponent(pathname || "/coordinator");
      router.replace(`/login?next=${next}`);
    };

    if (!hasAuthToken()) {
      redirectToLogin();
      return () => {
        active = false;
      };
    }

    getCurrentUser()
      .then((user) => {
        if (!active) return;
        if (!["coordinator", "admin"].includes(user.role)) {
          clearAuthTokens();
          redirectToLogin();
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        clearAuthTokens();
        redirectToLogin();
      });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (!ready) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Checking coordinator session...</div>;
  }

  return <>{children}</>;
}
