"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  Building2,
  Calendar,
  ExternalLink,
  FlaskConical,
  Filter,
  ChevronRight,
  Globe2,
} from "lucide-react";
import { mockTrials } from "@/lib/mock-data";
import type { Trial } from "@/lib/mock-data";
import { ENABLE_MOCK_FALLBACK, getTrials } from "@/lib/api";
import { audienceCopy } from "@/lib/dev-mode";
import { formatFriendlyDateTime } from "@/lib/date";

const statusLabels: Record<string, { label: string; className: string }> = {
  RECRUITING: {
    label: "Recruiting",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  NOT_YET_RECRUITING: {
    label: "Not Yet Recruiting",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  ACTIVE_NOT_RECRUITING: {
    label: "Active, Not Recruiting",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

function TrialsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-96" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 flex-1" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-[160px]" />
              <Skeleton className="h-10 w-[130px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-4 w-28" />

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Card key={`trial-skeleton-${idx}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function TrialsDirectoryPage() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [expandedTrial, setExpandedTrial] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    getTrials()
      .then((liveTrials) => {
        if (!mounted) return;
        setTrials(liveTrials);
        setError("");
      })
      .catch(() => {
        if (!mounted) return;
        if (ENABLE_MOCK_FALLBACK) {
          setTrials(mockTrials);
          setError(
            audienceCopy(
              "Service is temporarily unavailable. Showing demo trial data.",
              "Backend unavailable. Showing demo fallback trials.",
            ),
          );
          return;
        }
        setError(
          audienceCopy(
            "Could not load trials right now.",
            "Could not load trials from API.",
          ),
        );
      })
      .finally(() => {
        if (!mounted) return;
        setIsInitialLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (isInitialLoading) {
    return <TrialsSkeleton />;
  }

  const filteredTrials = trials.filter((trial) => {
    const matchesSearch =
      searchQuery === "" ||
      trial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trial.conditions.some((c) =>
        c.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      trial.interventions.some((i) =>
        i.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesStatus =
      statusFilter === "all" || trial.status === statusFilter;
    const matchesPhase =
      phaseFilter === "all" || trial.phase === phaseFilter;

    return matchesSearch && matchesStatus && matchesPhase;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Trials Directory
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and search clinical trials from ClinicalTrials.gov and Pakistan
          CTR.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by condition, drug, trial ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground sm:block hidden" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="RECRUITING">Recruiting</SelectItem>
                  <SelectItem value="NOT_YET_RECRUITING">
                    Not Yet Recruiting
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  <SelectItem value="Phase 2">Phase 2</SelectItem>
                  <SelectItem value="Phase 3">Phase 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {filteredTrials.length}
          </span>{" "}
          trials found
        </p>
      </div>
      {error && <p className="text-xs text-[hsl(var(--warning))]">{error}</p>}

      {/* Trial Cards */}
      <div className="space-y-3">
        {filteredTrials.map((trial) => {
          const status = statusLabels[trial.status];
          const isExpanded = expandedTrial === trial.id;

          return (
            <Card key={trial.id} className="overflow-hidden">
              <CardContent className="p-0">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 p-4 text-left"
                  onClick={() =>
                    setExpandedTrial(isExpanded ? null : trial.id)
                  }
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FlaskConical className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug text-foreground">
                        {trial.title}
                      </h3>
                      <ChevronRight
                        className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${status?.className}`}
                      >
                        {status?.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                      >
                        {trial.phase}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px]"
                      >
                        <Globe2 className="h-2.5 w-2.5" />
                        {trial.source === "pakistan_ctr"
                          ? "Pakistan CTR"
                          : "ClinicalTrials.gov"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {trial.id}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                    {/* Summary */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Summary
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {trial.summary}
                      </p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Conditions
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {trial.conditions.map((c) => (
                            <Badge
                              key={c}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Interventions
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {trial.interventions.map((iv) => (
                            <Badge
                              key={iv}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {iv}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Eligibility */}
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Eligibility Criteria (Summary)
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {trial.eligibilitySummary}
                      </p>
                    </div>

                    {/* Locations */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Recruiting Locations
                      </p>
                      <div className="mt-2 space-y-2">
                        {trial.locations.map((loc, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{loc.facility}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {loc.city}, {loc.country}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Sponsor: {trial.sponsor}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Updated {formatFriendlyDateTime(trial.lastUpdated, "Recently")}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 bg-transparent text-xs"
                        asChild
                      >
                        <a
                          href={
                            trial.source === "clinicaltrials.gov"
                              ? `https://clinicaltrials.gov/study/${trial.id}`
                              : "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Source
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filteredTrials.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Search className="h-10 w-10 text-muted-foreground/30" />
              <h3 className="mt-4 text-base font-semibold text-foreground">
                No trials found
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
