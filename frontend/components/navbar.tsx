"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  Heart,
  ArrowRight,
} from "lucide-react";

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            TrialBridge
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How It Works
          </Link>
          <Link
            href="#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </Link>
          <Link
            href="#regions"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Regions
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            For Coordinators
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/patient/intake" className="gap-1.5">
              Get Matched
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <nav className="mt-8 flex flex-col gap-4">
              <Link
                href="#how-it-works"
                onClick={() => setOpen(false)}
                className="text-lg font-medium text-foreground"
              >
                How It Works
              </Link>
              <Link
                href="#features"
                onClick={() => setOpen(false)}
                className="text-lg font-medium text-foreground"
              >
                Features
              </Link>
              <Link
                href="#regions"
                onClick={() => setOpen(false)}
                className="text-lg font-medium text-foreground"
              >
                Regions
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-lg font-medium text-foreground"
              >
                For Coordinators
              </Link>
              <div className="mt-4 flex flex-col gap-3">
                <Button variant="outline" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/patient/intake">Get Matched</Link>
                </Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
