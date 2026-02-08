"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBadge } from "@/components/coordinator/score-badge";
import { mockMatches, type MatchEvaluation } from "@/lib/mock-data";
import { ENABLE_MOCK_FALLBACK, getMatches } from "@/lib/api";
import { audienceCopy } from "@/lib/dev-mode";
import {
  Search,
  Filter,
  AlertTriangle,
  Clock,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

function UrgencyBadge({ flag }: { flag: MatchEvaluation["urgencyFlag"] }) {
  if (flag === "high")
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <AlertTriangle className="h-3 w-3" />
        High
      </Badge>
    );
  if (flag === "medium")
    return (
      <Badge className="gap-1 bg-[hsl(var(--warning))] text-xs text-[hsl(var(--warning-foreground))]">
        <Clock className="h-3 w-3" />
        Medium
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-xs">
      Low
    </Badge>
  );
}

function StatusBadge({
  status,
}: {
  status: MatchEvaluation["overallStatus"];
}) {
  if (status === "Eligible")
    return (
      <Badge className="bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]">
        {status}
      </Badge>
    );
  if (status === "Possibly Eligible")
    return (
      <Badge className="bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]">
        {status}
      </Badge>
    );
  return <Badge variant="destructive">{status}</Badge>;
}

function MatchesSkeleton() {
  return (
    <div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 flex-1" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[160px]" />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Card key={`match-skeleton-${idx}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-72" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="hidden h-7 w-16 sm:block" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchEvaluation[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("eligibility");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    getMatches()
      .then((liveMatches) => {
        if (!mounted) return;
        setMatches(liveMatches);
        setError("");
      })
      .catch(() => {
        if (!mounted) return;
        if (ENABLE_MOCK_FALLBACK) {
          setMatches(mockMatches);
          setError(
            audienceCopy(
              "Service is temporarily unavailable. Showing demo match data.",
              "Backend unavailable. Showing demo fallback matches.",
            ),
          );
          return;
        }
        setError(
          audienceCopy(
            "Could not load matches right now.",
            "Could not load matches from API.",
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
    return <MatchesSkeleton />;
  }

  let filtered = matches.filter((m) => {
    const matchesSearch =
      m.patient.name.toLowerCase().includes(search.toLowerCase()) ||
      m.trial.id.toLowerCase().includes(search.toLowerCase()) ||
      m.patient.diagnosis.toLowerCase().includes(search.toLowerCase());
    const matchesUrgency =
      urgencyFilter === "all" || m.urgencyFlag === urgencyFilter;
    return matchesSearch && matchesUrgency;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "eligibility")
      return b.eligibilityScore - a.eligibilityScore;
    if (sortBy === "feasibility")
      return b.feasibilityScore - a.feasibilityScore;
    if (sortBy === "urgency") {
      const order = { high: 3, medium: 2, low: 1 };
      return order[b.urgencyFlag] - order[a.urgencyFlag];
    }
    return 0;
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Matches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {matches.length} patient-trial matches evaluated
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by patient name, trial ID, or diagnosis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-3">
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Urgency</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eligibility">Eligibility Score</SelectItem>
              <SelectItem value="feasibility">Feasibility Score</SelectItem>
              <SelectItem value="urgency">Urgency Level</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-[hsl(var(--warning))]">{error}</p>}

      <div className="mt-6 space-y-3">
        {filtered.map((match) => (
          <Link
            key={match.id}
            href={`/coordinator/matches/${match.id}`}
            className="block"
          >
            <Card className="transition-all hover:border-primary/20 hover:shadow-md hover:shadow-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {match.patient.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {match.patient.name}
                      </p>
                      {match.isNew && (
                        <Badge
                          variant="default"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          NEW
                        </Badge>
                      )}
                      <StatusBadge status={match.overallStatus} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {match.patient.diagnosis} &middot;{" "}
                      {match.patient.stage} &middot;{" "}
                      {match.patient.city}, {match.patient.country}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {match.trial.id}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {match.trial.phase}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                      >
                        {match.trial.source === "pakistan_ctr"
                          ? "Pakistan CTR"
                          : "CT.gov"}
                      </Badge>
                    </div>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <ScoreBadge
                      score={match.eligibilityScore}
                      label="Elig"
                      size="default"
                    />
                    <ScoreBadge
                      score={match.feasibilityScore}
                      label="Feas"
                      size="default"
                    />
                  </div>

                  <div className="hidden md:block">
                    <UrgencyBadge flag={match.urgencyFlag} />
                  </div>

                  <div className="hidden items-center gap-2 lg:flex">
                    {match.missingInfo.length > 0 && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] text-[hsl(var(--warning))]"
                      >
                        <Clock className="h-3 w-3" />
                        {match.missingInfo.length} missing
                      </Badge>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No matches found
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Try adjusting your search or filters
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
