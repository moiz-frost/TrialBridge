import {
  Languages,
  MapPin,
  ShieldAlert,
  BarChart3,
  Stethoscope,
  RefreshCw,
} from "lucide-react";

const features = [
  {
    icon: Languages,
    title: "Multilingual Support",
    description:
      "AI-powered intake and outreach in English, Urdu, and Arabic. Plain-language trial summaries patients can actually understand.",
  },
  {
    icon: MapPin,
    title: "Feasibility Scoring",
    description:
      "Not just eligibility, but real-world fit. Distance to site, visit burden, caregiver availability, and travel constraints factored in.",
  },
  {
    icon: ShieldAlert,
    title: "Urgency Indicators",
    description:
      "Flags high-urgency patients (progressing disease, limited options) for priority coordinator review. Decision support, not automatic rationing.",
  },
  {
    icon: BarChart3,
    title: "Explainable AI Matching",
    description:
      "Every match shows criterion-by-criterion reasoning. What matched, what failed, what information is missing, and what the doctor needs to check.",
  },
  {
    icon: Stethoscope,
    title: "Doctor-Ready Checklists",
    description:
      "Auto-generated lab orders, imaging requests, and clinical questions needed to confirm eligibility. Coordinators save hours per patient.",
  },
  {
    icon: RefreshCw,
    title: "Daily Re-Matching",
    description:
      "Matches refresh daily as new trials open, patient data is updated, or trial statuses change. Coordinators see what is new each morning.",
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="border-t border-border/50 bg-background px-4 py-20 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Key Features
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold text-foreground lg:text-4xl">
            Built for the reality of emerging-market healthcare
          </h2>
          <p className="mt-4 text-muted-foreground">
            Where patients lack awareness, language is a barrier, and hospitals
            need workflow tools that actually fit how they work.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/20 hover:shadow-md hover:shadow-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
