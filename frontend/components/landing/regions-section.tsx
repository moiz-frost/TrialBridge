import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

const regions = [
  {
    country: "Pakistan",
    flag: "PK",
    readiness: "Active",
    registries: ["ClinicalTrials.gov", "Pakistan CTR (DRAP)"],
    dataMode: "Manual intake + hospital records",
    languages: ["English", "Urdu"],
    channels: ["SMS", "WhatsApp", "Phone"],
    note: "National Digital Health Framework 2022-2030 in progress",
  },
  {
    country: "UAE",
    flag: "AE",
    readiness: "Active",
    registries: ["ClinicalTrials.gov"],
    dataMode: "HIE integration ready (NABIDH / Malaffi / Riayati)",
    languages: ["English", "Arabic"],
    channels: ["WhatsApp", "Email", "Phone"],
    note: "Unified medical records via Riayati platform",
  },
  {
    country: "Saudi Arabia",
    flag: "SA",
    readiness: "Coming Soon",
    registries: ["ClinicalTrials.gov", "Saudi CTR (SCTR)"],
    dataMode: "NPHIES integration planned",
    languages: ["English", "Arabic"],
    channels: ["SMS", "WhatsApp"],
    note: "Official Saudi Clinical Trials Registry supported",
  },
  {
    country: "India",
    flag: "IN",
    readiness: "Coming Soon",
    registries: ["ClinicalTrials.gov", "CTRI India"],
    dataMode: "ABDM / ABHA ID integration planned",
    languages: ["English", "Hindi"],
    channels: ["SMS", "WhatsApp"],
    note: "Digital health ecosystem with ABHA IDs expanding",
  },
];

function ReadinessIcon({ readiness }: { readiness: string }) {
  if (readiness === "Active")
    return <CheckCircle2 className="h-4 w-4 text-primary-foreground" />;
  if (readiness === "Coming Soon")
    return <AlertCircle className="h-4 w-4 text-[hsl(var(--warning))]" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

export function RegionsSection() {
  return (
    <section
      id="regions"
      className="border-t border-border/50 bg-card px-4 py-20 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Regional Coverage
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold text-foreground lg:text-4xl">
            Global directory, local understanding
          </h2>
          <p className="mt-4 text-muted-foreground">
            Each region has unique data access, registries, and communication
            channels. TrialBridge adapts to local realities.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {regions.map((region) => (
            <div
              key={region.country}
              className="rounded-xl border border-border/50 bg-background p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" role="img" aria-label={region.country}>
                    {region.flag === "PK"
                      ? "\u{1F1F5}\u{1F1F0}"
                      : region.flag === "AE"
                        ? "\u{1F1E6}\u{1F1EA}"
                        : region.flag === "SA"
                          ? "\u{1F1F8}\u{1F1E6}"
                          : "\u{1F1EE}\u{1F1F3}"}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">
                    {region.country}
                  </h3>
                </div>
                <Badge
                  variant={
                    region.readiness === "Active" ? "default" : "secondary"
                  }
                  className="gap-1"
                >
                  <ReadinessIcon readiness={region.readiness} />
                  {region.readiness}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Registries
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {region.registries.map((r) => (
                      <Badge
                        key={r}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Patient Data Access
                  </p>
                  <p className="mt-0.5 text-sm text-foreground">
                    {region.dataMode}
                  </p>
                </div>
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Languages
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">
                      {region.languages.join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Outreach Channels
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">
                      {region.channels.join(", ")}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {region.note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
