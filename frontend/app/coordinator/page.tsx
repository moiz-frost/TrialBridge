"use client";

import React, { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "@/components/coordinator/score-badge";
import {
  mockMatches,
  dashboardStats,
  type MatchEvaluation,
} from "@/lib/mock-data";
import {
  ApiError,
  ENABLE_MOCK_FALLBACK,
  getDashboardStats,
  getMatches,
  runMatchingNow,
} from "@/lib/api";
import { audienceCopy } from "@/lib/dev-mode";
import { formatFriendlyDateTime, formatRelativeUpdate } from "@/lib/date";
import {
  Zap,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  Users,
  FlaskConical,
  TrendingUp,
  ArrowRight,
  ChevronRight,
  Loader2,
} from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  accent?: "primary" | "warning" | "destructive" | "default";
}) {
  const iconColor =
    accent === "primary"
      ? "text-primary bg-primary/10"
      : accent === "warning"
        ? "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)]"
        : accent === "destructive"
          ? "text-destructive bg-destructive/10"
          : "text-muted-foreground bg-muted";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconColor}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {subtext && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
              {subtext}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

function OutreachStatusBadge({
  status,
}: {
  status: MatchEvaluation["outreachStatus"];
}) {
  const config: Record<
    string,
    { label: string; className: string }
  > = {
    pending: {
      label: "Pending",
      className: "bg-muted text-muted-foreground",
    },
    draft: {
      label: "Draft",
      className: "bg-muted text-muted-foreground",
    },
    sent: {
      label: "Sent",
      className: "bg-primary/10 text-primary",
    },
    delivered: {
      label: "Delivered",
      className: "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]",
    },
    replied: {
      label: "Replied",
      className: "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]",
    },
    no_response: {
      label: "No Response",
      className: "bg-destructive/10 text-destructive",
    },
  };

  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

type DashboardStats = {
  newMatches: number;
  highUrgency: number;
  awaitingInfo: number;
  outreachPending: number;
  totalPatients: number;
  totalTrials: number;
  avgEligibility: number;
  matching: {
    is_running: boolean;
    running_run_id: number | null;
    running_started_at: string | null;
    latest_run_status: string | null;
    latest_run_started_at: string | null;
    last_completed_at: string | null;
  };
};

function DashboardSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="hidden h-9 w-36 sm:block" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={`stats-${idx}`}>
            <CardContent className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={`totals-${idx}`}>
            <CardContent className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-20" />
        </CardHeader>
        <CardContent className="space-y-3 p-6 pt-0">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={`row-${idx}`} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CoordinatorDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    newMatches: dashboardStats.newMatches,
    highUrgency: dashboardStats.highUrgency,
    awaitingInfo: dashboardStats.awaitingInfo,
    outreachPending: dashboardStats.outreachPending,
    totalPatients: dashboardStats.totalPatients,
    totalTrials: dashboardStats.totalTrials,
    avgEligibility: dashboardStats.avgEligibility,
    matching: {
      is_running: false,
      running_run_id: null,
      running_started_at: null,
      latest_run_status: null,
      latest_run_started_at: null,
      last_completed_at: null,
    },
  });
  const [recentMatches, setRecentMatches] = useState<MatchEvaluation[]>([]);
  const [allMatches, setAllMatches] = useState<MatchEvaluation[]>([]);
  const [error, setError] = useState("");
  const [isRunningNow, setIsRunningNow] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const refreshDashboard = useCallback(async () => {
    const [liveStats, liveMatches] = await Promise.all([getDashboardStats(), getMatches()]);
    setStats(liveStats);
    setAllMatches(liveMatches);
    setRecentMatches(liveMatches.slice(0, 5));
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    refreshDashboard()
      .then(() => {
        if (!mounted) return;
        setIsInitialLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        if (ENABLE_MOCK_FALLBACK) {
          setStats({
            newMatches: dashboardStats.newMatches,
            highUrgency: dashboardStats.highUrgency,
            awaitingInfo: dashboardStats.awaitingInfo,
            outreachPending: dashboardStats.outreachPending,
            totalPatients: dashboardStats.totalPatients,
            totalTrials: dashboardStats.totalTrials,
            avgEligibility: dashboardStats.avgEligibility,
            matching: {
              is_running: false,
              running_run_id: null,
              running_started_at: null,
              latest_run_status: null,
              latest_run_started_at: null,
              last_completed_at: null,
            },
          });
          setAllMatches(mockMatches);
          setRecentMatches(mockMatches.slice(0, 5));
          setError(
            audienceCopy(
              "Service is temporarily unavailable. Showing demo dashboard data.",
              "Backend unavailable. Showing demo fallback data.",
            ),
          );
          setIsInitialLoading(false);
          return;
        }
        setError(
          audienceCopy(
            "Could not load dashboard data right now.",
            "Could not load dashboard data from API.",
          ),
        );
        setIsInitialLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [refreshDashboard]);

  useEffect(() => {
    if (!stats.matching?.is_running) return;
    const timer = window.setInterval(() => {
      refreshDashboard().catch(() => {
        // Keep existing UI state on polling errors.
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshDashboard, stats.matching?.is_running]);

  const serverRunInProgress = Boolean(stats.matching?.is_running);
  const runButtonDisabled = isRunningNow || serverRunInProgress;
  const refreshLabel = (() => {
    if (serverRunInProgress && stats.matching.running_started_at) {
      return `Matching run in progress (started ${formatRelativeUpdate(stats.matching.running_started_at)}).`;
    }
    if (stats.matching?.last_completed_at) {
      return `Last match refresh: ${formatFriendlyDateTime(stats.matching.last_completed_at)}.`;
    }
    return "No matching run has completed yet.";
  })();

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            size="sm"
            className="hidden gap-1.5 sm:flex"
            disabled={runButtonDisabled}
            onClick={async () => {
              if (runButtonDisabled) return;
              setIsRunningNow(true);
              setError("");
              try {
                await runMatchingNow();
                await refreshDashboard();
              } catch (err) {
                if (err instanceof ApiError && err.status === 409) {
                  setError("A matching run is already in progress.");
                  await refreshDashboard();
                } else {
                  setError("Manual matching run failed. Please try again.");
                }
              } finally {
                setIsRunningNow(false);
              }
            }}
          >
            {runButtonDisabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {runButtonDisabled ? "Run In Progress" : "Run Matching Now"}
          </Button>
          <p className="text-sm text-muted-foreground">{refreshLabel}</p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-[hsl(var(--warning))]">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Zap}
          label="New Matches"
          value={stats.newMatches}
          subtext="Since last refresh"
          accent="primary"
        />
        <StatCard
          icon={AlertTriangle}
          label="High Urgency"
          value={stats.highUrgency}
          subtext="Requires priority review"
          accent="destructive"
        />
        <StatCard
          icon={Clock}
          label="Awaiting Info"
          value={stats.awaitingInfo}
          subtext="Missing patient data"
          accent="warning"
        />
        <StatCard
          icon={Send}
          label="Outreach Pending"
          value={stats.outreachPending}
          subtext="Ready to send"
          accent="default"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users}
          label="Total Patients"
          value={stats.totalPatients}
        />
        <StatCard
          icon={FlaskConical}
          label="Active Trials"
          value={stats.totalTrials}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Eligibility Score"
          value={`${stats.avgEligibility}%`}
          subtext="Across all matches"
        />
      </div>

      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold">
            Recent Matches
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href="/coordinator/matches">
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 text-left">Patient</th>
                  <th className="px-6 py-3 text-left">Trial</th>
                  <th className="px-6 py-3 text-center">Eligibility</th>
                  <th className="px-6 py-3 text-center">Feasibility</th>
                  <th className="px-6 py-3 text-center">Urgency</th>
                  <th className="px-6 py-3 text-center">Outreach</th>
                  <th className="px-6 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentMatches.map((match) => (
                  <tr
                    key={match.id}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {match.patient.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-foreground">
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
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {match.patient.diagnosis}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-[200px]">
                        <p className="truncate text-sm font-medium text-foreground">
                          {match.trial.id}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {match.trial.phase} &middot;{" "}
                          {match.trial.source === "pakistan_ctr"
                            ? "Pakistan CTR"
                            : "CT.gov"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <ScoreBadge score={match.eligibilityScore} size="sm" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <ScoreBadge score={match.feasibilityScore} size="sm" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <UrgencyBadge flag={match.urgencyFlag} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <OutreachStatusBadge status={match.outreachStatus} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/coordinator/matches/${match.id}`}>
                          <ChevronRight className="h-4 w-4" />
                          <span className="sr-only">View match details</span>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              Outreach Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  patient: "Fatima Zahra",
                  action: "WhatsApp message drafted",
                  time: "2 hours ago",
                  channel: "whatsapp",
                },
                {
                  patient: "Sara Al-Mansouri",
                  action: "Message delivered via WhatsApp",
                  time: "Yesterday",
                  channel: "whatsapp",
                },
                {
                  patient: "Noor Hussain",
                  action: "Email sent with trial details",
                  time: "2 days ago",
                  channel: "email",
                },
                {
                  patient: "Fatima Zahra",
                  action: "No response to SMS (follow-up due)",
                  time: "3 days ago",
                  channel: "sms",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {item.patient
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.patient}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.action}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Missing Information Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allMatches
                .filter((m) => m.missingInfo.length > 0)
                .slice(0, 4)
                .map((match) => (
                  <div
                    key={match.id}
                    className="rounded-lg border border-border/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {match.patient.name}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {match.missingInfo.length} item
                        {match.missingInfo.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {match.missingInfo.slice(0, 2).map((info, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1.5 text-xs text-muted-foreground"
                        >
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--warning))]" />
                          {info}
                        </li>
                      ))}
                      {match.missingInfo.length > 2 && (
                        <li className="text-xs text-muted-foreground/60">
                          +{match.missingInfo.length - 2} more
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
