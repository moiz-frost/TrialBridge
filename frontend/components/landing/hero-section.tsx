import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Globe, ShieldCheck } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background px-4 pb-20 pt-16 lg:px-8 lg:pb-32 lg:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(173_58%_39%/0.08),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="secondary"
            className="mb-6 gap-1.5 px-3 py-1.5 text-sm font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Clinical Trial Matching
          </Badge>

          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Connecting Patients to{" "}
            <span className="text-primary">Life-Saving Trials</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground lg:text-xl">
            TrialBridge uses AI to match patients with clinical trials they never
            knew existed. Built for emerging markets where awareness, language,
            and access are the biggest barriers to hope.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="gap-2 text-base">
              <Link href="/patient/intake">
                Find a Trial for Me
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="gap-2 text-base bg-transparent"
            >
              <Link href="/login">Coordinator Dashboard</Link>
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span>Pakistan, UAE, Saudi Arabia, India</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Not medical advice - clinician review required</span>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-xl shadow-primary/5 lg:p-8">
            <div className="grid gap-6 md:grid-cols-3">
              <StatCard
                value="80%"
                label="of trials fail enrollment timelines"
                sublabel="Recruitment is the #1 bottleneck"
              />
              <StatCard
                value="32%"
                label="of trial costs go to enrollment"
                sublabel="Deloitte feasibility analysis"
              />
              <StatCard
                value="11%"
                label="of sites fail to enroll even 1 patient"
                sublabel="Access and awareness gap"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  value,
  label,
  sublabel,
}: {
  value: string;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-primary lg:text-4xl">{value}</div>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}
