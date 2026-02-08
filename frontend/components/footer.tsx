import Link from "next/link";
import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-[hsl(200_25%_10%)] px-4 py-12 text-[hsl(195_15%_80%)] lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Heart className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-[hsl(0_0%_100%)]">
                TrialBridge
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[hsl(195_15%_60%)]">
              AI-powered clinical trial matching for emerging markets. Bridging
              the gap between patients and trials through coordinator-driven
              workflows, multilingual AI, and low-tech outreach.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[hsl(195_15%_60%)]">
              Platform
            </h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/patient/intake"
                  className="text-sm hover:text-[hsl(0_0%_100%)]"
                >
                  Patient Intake
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-sm hover:text-[hsl(0_0%_100%)]"
                >
                  Coordinator Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/login?next=%2Fcoordinator%2Ftrials"
                  className="text-sm hover:text-[hsl(0_0%_100%)]"
                >
                  Trials Directory
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[hsl(195_15%_60%)]">
              Resources
            </h4>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="text-sm">ClinicalTrials.gov</span>
              </li>
              <li>
                <span className="text-sm">Pakistan CTR (DRAP)</span>
              </li>
              <li>
                <span className="text-sm">WHO ICTRP</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-[hsl(200_15%_20%)] pt-6">
          <p className="text-center text-xs text-[hsl(195_15%_50%)]">
            TrialBridge is a decision-support tool. All matches require
            clinician review and confirmation. This is not medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
