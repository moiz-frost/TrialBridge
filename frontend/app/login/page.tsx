"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Eye, EyeOff, Heart, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, loginCoordinator } from "@/lib/api";
import { hasAuthToken } from "@/lib/auth";
import { normalizeWhitespace } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/coordinator");

  const [username, setUsername] = useState("coordinator");
  const [password, setPassword] = useState("coordinator123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const queryNext = new URLSearchParams(window.location.search).get("next");
      if (queryNext) setNextPath(queryNext);
    }
  }, []);

  useEffect(() => {
    if (!hasAuthToken()) return;
    getCurrentUser()
      .then((user) => {
        if (["coordinator", "admin"].includes(user.role)) {
          router.replace(nextPath);
        }
      })
      .catch(() => {
        // Session validation intentionally ignored here; user can submit credentials.
      });
  }, [nextPath, router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const normalizedUsername = normalizeWhitespace(username);
    if (!normalizedUsername) {
      setError("Please enter your username.");
      return;
    }
    if (!password || password.trim().length < 4) {
      setError("Please enter your password.");
      return;
    }
    setLoading(true);
    try {
      await loginCoordinator(normalizedUsername, password);
      const user = await getCurrentUser();
      if (!["coordinator", "admin"].includes(user.role)) {
        setError("This account is not a coordinator/admin account.");
        setLoading(false);
        return;
      }
      router.replace(nextPath);
    } catch {
      setError("Invalid credentials. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">TrialBridge</span>
          </div>
          <CardTitle className="text-xl">Coordinator Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Patient? <Link href="/patient/intake" className="text-primary underline">Start intake here</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
