import {
  FileText,
  Brain,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import { audienceCopy } from "@/lib/dev-mode";

const steps = [
  {
    icon: FileText,
    title: "Patient Intake",
    description:
      "Patients or hospital staff enter medical history as a free-text story in English, Urdu, or Arabic. Upload documents or paste lab results.",
    detail: audienceCopy(
      "AI reviews patient stories and highlights important medical details.",
      "AI extracts structured profile from unstructured narratives",
    ),
  },
  {
    icon: Brain,
    title: "AI Matching",
    description: audienceCopy(
      "Our system searches ClinicalTrials.gov and local registries, then checks trial eligibility details step by step.",
      "Our system searches ClinicalTrials.gov and local registries using embedding-based retrieval, then evaluates eligibility criterion by criterion.",
    ),
    detail: "Eligibility + Feasibility + Urgency scoring",
  },
  {
    icon: ListChecks,
    title: "Coordinator Review",
    description:
      "Trial coordinators see ranked matches with explainable scores, missing info checklists, and doctor-ready action items for each patient.",
    detail: "Full transparency on why each match was made",
  },
  {
    icon: MessageSquare,
    title: "Patient Outreach",
    description:
      "Coordinators send multilingual messages via SMS, WhatsApp, or phone. Track delivery, responses, and next steps all in one place.",
    detail: "Low-tech outreach for under-resourced populations",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="border-t border-border/50 bg-card px-4 py-20 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            How It Works
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold text-foreground lg:text-4xl">
            From patient story to matched trial in minutes
          </h2>
          <p className="mt-4 text-muted-foreground">
            A transparent, coordinator-driven workflow designed for hospitals in
            emerging markets.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div key={step.title} className="relative">
              <div className="flex flex-col items-start">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-6 w-6" />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Step {idx + 1}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                <p className="mt-3 rounded-md bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
