"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  ENABLE_MOCK_FALLBACK,
  addPatientHistoryEntry,
  getPatientHistoryEntries,
  getPatientPortalMatches,
  type PatientHistoryEntryItem,
} from "@/lib/api";
import type { MatchEvaluation } from "@/lib/mock-data";
import { clearPatientSession, getPatientSession } from "@/lib/patient-session";
import { formatFriendlyDateTime, formatRelativeUpdate } from "@/lib/date";
import { normalizeWhitespace, validateNarrativeText } from "@/lib/validation";
import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  ChevronRight,
  ShieldCheck,
  Heart,
  Info,
  Building2,
  FlaskConical,
  PlusCircle,
} from "lucide-react";

// Simulating the patient's view of their matches
const defaultPatientMatchResults = [
  {
    id: "MATCH-001",
    trialTitle: "New Treatment for HER2+ Breast Cancer",
    trialId: "NCT06812345",
    hospital: "Aga Khan University Hospital",
    city: "Karachi",
    matchStrength: "Strong Match",
    matchScore: 89,
    status: "coordinator_reviewing",
    plainLanguageSummary:
      "This trial is testing a new targeted medicine for breast cancer that is HER2-positive. The medicine is designed to deliver chemotherapy directly to cancer cells, which may be more effective with fewer side effects than standard chemotherapy.",
    whatItMeans:
      "Based on your medical story, you appear to meet the key requirements for this trial. Your HER2-positive diagnosis and prior treatment with trastuzumab make you a good candidate.",
    nextSteps: [
      "A coordinator at Aga Khan is reviewing your information",
      "You may need some additional blood tests",
      "A doctor will need to confirm your eligibility in person",
    ],
    lastUpdated: "2 hours ago",
  },
  {
    id: "MATCH-004",
    trialTitle: "Antibody Drug Treatment for Advanced Breast Cancer",
    trialId: "DRAP-2026-0042",
    hospital: "Jinnah Postgraduate Medical Centre",
    city: "Karachi",
    matchStrength: "Possible Match",
    matchScore: 71,
    status: "needs_info",
    plainLanguageSummary:
      "This trial studies a new type of medicine called an antibody-drug conjugate for patients whose breast cancer has not responded to previous treatments. It combines an antibody that finds cancer cells with a powerful medicine to destroy them.",
    whatItMeans:
      "You may qualify for this trial, but we need to confirm some details about your treatment history. The trial requires at least two previous rounds of treatment.",
    nextSteps: [
      "We need to confirm your complete treatment history",
      "A CT scan may be needed to assess your current condition",
      "We will keep you updated once we verify the details",
    ],
    lastUpdated: "1 day ago",
  },
];
type PatientPortalMatch = (typeof defaultPatientMatchResults)[number];

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  coordinator_reviewing: {
    label: "Coordinator Reviewing",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  needs_info: {
    label: "More Info Needed",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Info className="h-3.5 w-3.5" />,
  },
  confirmed: {
    label: "Confirmed Eligible",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  contacted: {
    label: "Coordinator Contacted You",
    color: "bg-primary/10 text-primary border-primary/20",
    icon: <Phone className="h-3.5 w-3.5" />,
  },
};

function historySourceLabel(source: PatientHistoryEntryItem["source"]) {
  if (source === "intake") return "Initial Intake";
  if (source === "patient_portal") return "Added by You";
  return "Added by Coordinator";
}

function PatientPortalSkeleton() {
  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="w-full space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={`journey-skeleton-${idx}`} className="flex flex-1 flex-col items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Skeleton className="h-6 w-44" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={`portal-match-skeleton-${idx}`}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </div>
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function toPortalMatch(match: MatchEvaluation) {
  const score = Math.round((match.eligibilityScore + match.feasibilityScore) / 2);
  const mappedStatus =
    match.outreachStatus === "replied"
      ? "confirmed"
      : match.missingInfo.length > 0
        ? "needs_info"
        : "coordinator_reviewing";

  return {
    id: match.id,
    trialTitle: match.trial.title,
    trialId: match.trial.id,
    hospital: match.trial.locations[0]?.facility || "Hospital coordinator",
    city: match.trial.locations[0]?.city || match.patient.city,
    matchStrength: score >= 80 ? "Strong Match" : "Possible Match",
    matchScore: score,
    status: mappedStatus,
    plainLanguageSummary:
      match.reasonsMatched[0] ||
      "Potential match found. Coordinator review is required before enrollment.",
    whatItMeans:
      match.reasonsFailed[0] ||
      "Based on your profile, this trial appears relevant. Final eligibility needs clinician confirmation.",
    nextSteps:
      match.missingInfo.length > 0
        ? match.missingInfo
        : match.doctorChecklist.length > 0
          ? match.doctorChecklist
          : ["Coordinator review in progress"],
    lastUpdated: match.lastEvaluated,
  };
}

export default function PatientPortalPage() {
  const router = useRouter();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("Patient");
  const [patientMatchResults, setPatientMatchResults] = useState<PatientPortalMatch[]>([]);
  const [historyEntries, setHistoryEntries] = useState<PatientHistoryEntryItem[]>([]);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [historyDraft, setHistoryDraft] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");
  const [isSubmittingHistory, setIsSubmittingHistory] = useState(false);
  const [error, setError] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    const session = getPatientSession();
    if (!session?.id) {
      router.replace("/patient/login?next=/patient/portal");
      setIsInitialLoading(false);
      return;
    }

    setPatientId(session.id);
    setPatientName(session.name || "Patient");

    Promise.all([getPatientPortalMatches(session.id), getPatientHistoryEntries(session.id)])
      .then(([matches, entries]) => {
        if (!mounted) return;
        const mapped = matches.map(toPortalMatch);
        setHistoryEntries(entries || []);
        if (mapped.length === 0) {
          setPatientMatchResults([]);
          setExpandedMatch(null);
          setError("No matched trials available yet.");
          return;
        }
        setPatientMatchResults(mapped);
        setExpandedMatch(mapped[0].id);
        setError("");
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearPatientSession();
          router.replace("/patient/login?next=/patient/portal");
          return;
        }
        if (ENABLE_MOCK_FALLBACK) {
          setPatientMatchResults(defaultPatientMatchResults);
          setHistoryEntries([]);
          setExpandedMatch(defaultPatientMatchResults[0]?.id ?? null);
          setError("Backend unavailable. Showing demo portal cards.");
          return;
        }
        setError("Could not load patient matches.");
      })
      .finally(() => {
        if (!mounted) return;
        setIsInitialLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleAddHistory = async () => {
    if (!patientId) return;
    const entryText = normalizeWhitespace(historyDraft);
    const narrativeError = validateNarrativeText(entryText, {
      minLength: 20,
      minTokens: 4,
      requireMedicalSignal: true,
    });
    if (narrativeError) {
      setHistoryError(narrativeError);
      return;
    }

    setIsSubmittingHistory(true);
    setHistoryError("");
    setHistoryNotice("");

    try {
      const response = await addPatientHistoryEntry(patientId, entryText);
      setHistoryDraft("");
      setHistoryEntries((prev) => [response.entry, ...prev]);
      setHistoryNotice("Information added. Refreshing your match list...");

      const refreshedMatches = await getPatientPortalMatches(patientId);
      const mappedMatches = refreshedMatches.map(toPortalMatch);
      setPatientMatchResults(mappedMatches);
      setExpandedMatch((current) =>
        current && mappedMatches.some((match) => match.id === current)
          ? current
          : (mappedMatches[0]?.id ?? null),
      );

      const updatedCount = Number(response.matches_updated || 0);
      setHistoryNotice(
        updatedCount > 0
          ? `Information added. ${updatedCount} ${updatedCount === 1 ? "match was" : "matches were"} re-evaluated.`
          : "Information added. Your profile and matches were refreshed.",
      );
      setError(mappedMatches.length === 0 ? "No matched trials available yet." : "");
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearPatientSession();
        router.replace("/patient/login?next=/patient/portal");
        return;
      }
      setHistoryError("Could not add information right now. Please try again.");
    } finally {
      setIsSubmittingHistory(false);
    }
  };

  if (isInitialLoading) {
    return <PatientPortalSkeleton />;
  }

  return (
    <div>
      {/* Welcome Card */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Welcome back, {patientName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We found{" "}
                <a
                  href="#matched-trials"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {patientMatchResults.length} potential clinical trials
                </a>{" "}
                that may be relevant to your condition. A hospital coordinator is
                reviewing the top match.
              </p>
              {error && <p className="mt-2 text-xs text-[hsl(var(--warning))]">{error}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Journey</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {[
              { label: "Info Submitted", done: true },
              { label: "AI Matching", done: true },
              { label: "Coordinator Review", done: false, active: true },
              { label: "Doctor Verification", done: false },
              { label: "Enrollment", done: false },
            ].map((s, i) => (
              <div key={s.label} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <div
                    className={`h-0.5 flex-1 ${
                      i === 0
                        ? "bg-transparent"
                        : s.done
                          ? "bg-primary"
                          : s.active
                            ? "bg-primary/40"
                            : "bg-border"
                    }`}
                  />
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      s.done
                        ? "bg-primary text-primary-foreground"
                        : s.active
                          ? "border-2 border-primary bg-background text-primary"
                          : "border border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div
                    className={`h-0.5 flex-1 ${
                      i === 4
                        ? "bg-transparent"
                        : s.done
                          ? "bg-primary"
                          : "bg-border"
                    }`}
                  />
                </div>
                <span
                  className={`mt-1.5 text-center text-[10px] leading-tight ${
                    s.done || s.active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add to Your Medical History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share new updates about symptoms, test results, treatments, or diagnosis changes. New entries are appended to your history and older notes stay unchanged.
          </p>
          <Textarea
            value={historyDraft}
            onChange={(event) => setHistoryDraft(event.target.value)}
            placeholder="Example: My latest blood work was completed on Monday and my doctor confirmed ECOG remains 1."
            rows={4}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleAddHistory}
              disabled={isSubmittingHistory || historyDraft.trim().length < 5}
              className="gap-1.5"
            >
              <PlusCircle className="h-4 w-4" />
              {isSubmittingHistory ? "Adding..." : "Add Information"}
            </Button>
            {historyNotice && <span className="text-xs text-[hsl(var(--success))]">{historyNotice}</span>}
            {historyError && <span className="text-xs text-destructive">{historyError}</span>}
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">History Log</p>
            {historyEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet beyond your initial profile.</p>
            ) : (
              historyEntries.slice(0, 6).map((entry) => (
                <div key={entry.id} className="rounded-md border border-border/60 bg-background p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {historySourceLabel(entry.source)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground" title={formatFriendlyDateTime(entry.created_at)}>
                      {formatRelativeUpdate(entry.created_at)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{entry.entry_text}</p>
                </div>
              ))
            )}
            {historyEntries.length > 6 && (
              <p className="text-xs text-muted-foreground">
                Showing latest 6 entries.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Match Results */}
      <div className="space-y-4" id="matched-trials">
        <h2 className="text-base font-semibold text-foreground">
          Your Matched Trials
        </h2>

        {patientMatchResults.map((match) => {
          const status = statusConfig[match.status];
          const isExpanded = expandedMatch === match.id;

          return (
            <Card
              key={match.id}
              className={`transition-all ${isExpanded ? "ring-1 ring-primary/20" : ""}`}
            >
              <CardContent className="p-0">
                {/* Header Row */}
                <button
                  type="button"
                  className="flex w-full items-start gap-3 p-4 text-left"
                  onClick={() =>
                    setExpandedMatch(isExpanded ? null : match.id)
                  }
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      match.matchScore >= 80
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    <FlaskConical className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {match.trialTitle}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {match.hospital}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {match.city}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`gap-1 text-[10px] ${status?.color}`}
                      >
                        {status?.icon}
                        {status?.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          match.matchScore >= 80
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {match.matchStrength}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Updated{" "}
                        <span title={formatFriendlyDateTime(match.lastUpdated, "No update time")}>
                          {formatRelativeUpdate(match.lastUpdated)}
                        </span>
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    {/* Match Score Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          Match Confidence
                        </span>
                        <span className="font-bold text-primary">
                          {match.matchScore}%
                        </span>
                      </div>
                      <Progress
                        value={match.matchScore}
                        className="mt-1.5 h-2"
                      />
                    </div>

                    {/* Plain Language Summary */}
                    <div className="mb-4 rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        About This Trial
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {match.plainLanguageSummary}
                      </p>
                    </div>

                    {/* What It Means For You */}
                    <div className="mb-4 rounded-lg bg-primary/5 p-3">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-primary">
                            What This Means For You
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-foreground">
                            {match.whatItMeans}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Next Steps */}
                    <div className="mb-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Next Steps
                      </p>
                      <ul className="mt-2 space-y-2">
                        {match.nextSteps.map((ns, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {i + 1}
                            </div>
                            <span className="text-sm text-foreground">
                              {ns}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Contact */}
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5 text-xs">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Message Coordinator
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 bg-transparent text-xs"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Request a Call
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help Card */}
      <Card className="mt-6 border-border">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Your Information Is Protected
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your medical information is only shared with hospital trial
              coordinators for the purpose of matching you with clinical trials.
              It is never sold or shared with third parties. You can request
              deletion of your data at any time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
