"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleHelp } from "lucide-react";
import {
  ENABLE_MOCK_FALLBACK,
  getCoordinatorSettings,
  updateCoordinatorSettings,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface Weights {
  eligibility: number;
  feasibility: number;
  urgency: number;
  explainability: number;
}
type WeightKey = keyof Weights;

const defaultWeights: Weights = {
  eligibility: 0.45,
  feasibility: 0.3,
  urgency: 0.2,
  explainability: 0.05,
};

const weightHelp: Record<
  WeightKey,
  {
    purpose: string;
    higher: string;
    lower: string;
  }
> = {
  eligibility: {
    purpose: "How well the patient appears to meet trial criteria.",
    higher: "Strict clinical-fit matches move higher in results.",
    lower: "More borderline matches remain visible for manual review.",
  },
  feasibility: {
    purpose: "Practical fit: location, travel burden, and visit feasibility.",
    higher: "Nearby/easier-to-attend trials move higher.",
    lower: "Distant or harder-to-attend trials can rank higher.",
  },
  urgency: {
    purpose: "Prioritizes patients who may need faster coordinator action.",
    higher: "High-urgency patients are pushed upward sooner.",
    lower: "Ranking focuses more on fit/logistics than urgency.",
  },
  explainability: {
    purpose: "Favors matches with clearer supporting information.",
    higher: "Clear, better-supported matches are promoted.",
    lower: "Less-complete but potentially useful matches stay visible.",
  },
};

function CoordinatorSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-4 w-44" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`weight-skeleton-${idx}`} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-36" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CoordinatorSettingsPage() {
  const [weightInputs, setWeightInputs] = useState<Record<WeightKey, string>>({
    eligibility: String(defaultWeights.eligibility),
    feasibility: String(defaultWeights.feasibility),
    urgency: String(defaultWeights.urgency),
    explainability: String(defaultWeights.explainability),
  });
  const [loadedWeights, setLoadedWeights] = useState<Weights>(defaultWeights);
  const [organization, setOrganization] = useState("Hospital Organization");
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info" | null;
    message: string;
  }>({ tone: null, message: "" });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (
    tone: "success" | "error" | "info",
    message: string,
    autoHideMs = 3200,
  ) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setNotice({ tone, message });
    noticeTimerRef.current = setTimeout(() => {
      setNotice({ tone: null, message: "" });
      noticeTimerRef.current = null;
    }, autoHideMs);
  };

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    getCoordinatorSettings()
      .then((settings) => {
        if (!mounted) return;
        setOrganization(String(settings.organization || "Hospital Organization"));
        const serverWeights = settings.score_weights as Partial<Weights> | undefined;
        if (serverWeights) {
          const merged = { ...defaultWeights, ...serverWeights };
          setWeightInputs({
            eligibility: String(merged.eligibility),
            feasibility: String(merged.feasibility),
            urgency: String(merged.urgency),
            explainability: String(merged.explainability),
          });
          setLoadedWeights(merged);
        }
      })
      .catch(() => {
        if (!mounted) return;
        if (ENABLE_MOCK_FALLBACK) {
          showNotice("error", "Backend unavailable. Using local demo defaults.");
          return;
        }
        showNotice("error", "Could not load coordinator settings.");
      })
      .finally(() => {
        if (!mounted) return;
        setIsInitialLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const parseWeight = (value: string): number => {
    if (value === "" || value === ".") return 0;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 0;
    return Math.min(1, Math.max(0, parsed));
  };

  const setWeight = (key: WeightKey, value: string) => {
    // Allow only decimal typing states and clamp values > 1 immediately.
    if (!/^\d*\.?\d*$/.test(value)) return;
    if (notice.tone) {
      setNotice({ tone: null, message: "" });
    }
    if (value !== "" && value !== ".") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && parsed > 1) {
        setWeightInputs((prev) => ({ ...prev, [key]: "1" }));
        return;
      }
    }
    setWeightInputs((prev) => ({ ...prev, [key]: value }));
  };

  const normalizeWeight = (key: WeightKey) => {
    setWeightInputs((prev) => ({
      ...prev,
      [key]: String(parseWeight(prev[key])),
    }));
  };

  const parsedWeights: Weights = {
    eligibility: parseWeight(weightInputs.eligibility),
    feasibility: parseWeight(weightInputs.feasibility),
    urgency: parseWeight(weightInputs.urgency),
    explainability: parseWeight(weightInputs.explainability),
  };

  const hasChanges =
    parsedWeights.eligibility !== loadedWeights.eligibility ||
    parsedWeights.feasibility !== loadedWeights.feasibility ||
    parsedWeights.urgency !== loadedWeights.urgency ||
    parsedWeights.explainability !== loadedWeights.explainability;

  const save = async () => {
    const invalidEntry = (Object.keys(weightInputs) as WeightKey[]).find((key) => {
      const raw = weightInputs[key].trim();
      if (raw === "" || raw === ".") return true;
      const parsed = Number(raw);
      return Number.isNaN(parsed) || parsed < 0 || parsed > 1;
    });
    if (invalidEntry) {
      showNotice("error", "Each weight must be a number between 0 and 1.");
      return;
    }

    if (!hasChanges) {
      showNotice("info", "No changes to save.");
      return;
    }

    try {
      await updateCoordinatorSettings({ ...parsedWeights });
      const refreshed = await getCoordinatorSettings();
      const serverWeights = (refreshed.score_weights as Partial<Weights> | undefined) || {};
      const merged = { ...defaultWeights, ...serverWeights };

      setWeightInputs({
        eligibility: String(merged.eligibility),
        feasibility: String(merged.feasibility),
        urgency: String(merged.urgency),
        explainability: String(merged.explainability),
      });
      setLoadedWeights(merged);

      const persistedOk =
        merged.eligibility === parsedWeights.eligibility &&
        merged.feasibility === parsedWeights.feasibility &&
        merged.urgency === parsedWeights.urgency &&
        merged.explainability === parsedWeights.explainability;

      if (!persistedOk) {
        showNotice("error", "Settings were not applied as expected. Please try again.");
        return;
      }

      showNotice("success", "Settings saved.");
    } catch {
      showNotice("error", "Could not save settings.");
    }
  };

  const totalWeight =
    parsedWeights.eligibility +
    parsedWeights.feasibility +
    parsedWeights.urgency +
    parsedWeights.explainability;
  const isTotalBalanced = totalWeight >= 0.95 && totalWeight <= 1.05;

  if (isInitialLoading) {
    return <CoordinatorSettingsSkeleton />;
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Org Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure ranking weights for {organization}.</p>
        <div className="mt-2 h-6">
          <p
            aria-live="polite"
            className={cn(
              "text-sm transition-opacity duration-200",
              notice.message ? "opacity-100" : "opacity-0",
              notice.tone === "success" && "text-[hsl(var(--success))]",
              notice.tone === "error" && "text-destructive",
              notice.tone === "info" && "text-muted-foreground",
            )}
          >
            {notice.message || " "}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Match Scoring Weights</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set each value between 0 and 1.
          </p>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Use values between 0 and 1. Keep the total close to 1.0 for
            balanced scoring.
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Current total:{" "}
            <span
              className={`font-semibold ${
                isTotalBalanced
                  ? "text-[hsl(var(--success))]"
                  : "text-[hsl(var(--warning))]"
              }`}
            >
              {totalWeight.toFixed(2)}
            </span>
            {!isTotalBalanced && (
              <span className="ml-2">
                (Tip: keep close to 1.00)
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  aria-label="How total weight works"
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Total near 1.00 keeps balanced weighting. Higher or lower totals
                still work, but emphasis can become uneven.
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Eligibility</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        aria-label="Eligibility help"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-xs">
                      <p>{weightHelp.eligibility.purpose}</p>
                      <p className="mt-1"><span className="font-semibold">Higher:</span> {weightHelp.eligibility.higher}</p>
                      <p><span className="font-semibold">Lower:</span> {weightHelp.eligibility.lower}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={weightInputs.eligibility}
                  onChange={(e) => setWeight("eligibility", e.target.value)}
                  onBlur={() => normalizeWeight("eligibility")}
                  inputMode="decimal"
                  placeholder="0 to 1"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Feasibility</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        aria-label="Feasibility help"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-xs">
                      <p>{weightHelp.feasibility.purpose}</p>
                      <p className="mt-1"><span className="font-semibold">Higher:</span> {weightHelp.feasibility.higher}</p>
                      <p><span className="font-semibold">Lower:</span> {weightHelp.feasibility.lower}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={weightInputs.feasibility}
                  onChange={(e) => setWeight("feasibility", e.target.value)}
                  onBlur={() => normalizeWeight("feasibility")}
                  inputMode="decimal"
                  placeholder="0 to 1"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Urgency</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        aria-label="Urgency help"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-xs">
                      <p>{weightHelp.urgency.purpose}</p>
                      <p className="mt-1"><span className="font-semibold">Higher:</span> {weightHelp.urgency.higher}</p>
                      <p><span className="font-semibold">Lower:</span> {weightHelp.urgency.lower}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={weightInputs.urgency}
                  onChange={(e) => setWeight("urgency", e.target.value)}
                  onBlur={() => normalizeWeight("urgency")}
                  inputMode="decimal"
                  placeholder="0 to 1"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Explainability</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        aria-label="Explainability help"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-xs">
                      <p>{weightHelp.explainability.purpose}</p>
                      <p className="mt-1"><span className="font-semibold">Higher:</span> {weightHelp.explainability.higher}</p>
                      <p><span className="font-semibold">Lower:</span> {weightHelp.explainability.lower}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={weightInputs.explainability}
                  onChange={(e) => setWeight("explainability", e.target.value)}
                  onBlur={() => normalizeWeight("explainability")}
                  inputMode="decimal"
                  placeholder="0 to 1"
                />
              </div>
          </div>

          <div className="sm:col-span-2">
            <Button onClick={save}>Save Settings</Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}
