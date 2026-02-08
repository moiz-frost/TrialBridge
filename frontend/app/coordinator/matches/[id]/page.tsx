"use client";

import React, { use, useEffect, useState } from "react";

import Link from "next/link";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { mockMatches, type MatchEvaluation } from "@/lib/mock-data";
import {
  ENABLE_MOCK_FALLBACK,
  getMatchDetail,
  getOutreachMessages,
  type OutreachMessageItem,
  sendOutreach,
} from "@/lib/api";
import { formatFriendlyDate, formatFriendlyDateTime, formatRelativeUpdate } from "@/lib/date";
import { SHOW_TECHNICAL_COPY, audienceCopy } from "@/lib/dev-mode";
import { normalizeWhitespace } from "@/lib/validation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  Send,
  Stethoscope,
  FileText,
  User,
  FlaskConical,
  TrendingUp,
  AlertTriangle,
  Clock,
  Globe,
  Sparkles,
} from "lucide-react";

function MatchDetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-8 w-36" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={`score-skeleton-${idx}`}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-6 w-56" />
        </CardContent>
      </Card>

      <div className="mt-8 space-y-4">
        <Skeleton className="h-11 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-6 w-32" />
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={`criteria-skeleton-${idx}`} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-6 w-36" />
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={`missing-skeleton-${idx}`} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [match, setMatch] = useState<MatchEvaluation | null>(
    ENABLE_MOCK_FALLBACK ? (mockMatches.find((m) => m.id === id) ?? null) : null
  );
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState<"whatsapp" | "sms" | "email" | "phone">("email");
  const [outreachBody, setOutreachBody] = useState("");
  const [outreachActivity, setOutreachActivity] = useState<OutreachMessageItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    Promise.all([getMatchDetail(id), getOutreachMessages()])
      .then(([liveMatch, liveOutreach]) => {
        if (!mounted) return;
        setMatch(liveMatch);
        setOutreachActivity(liveOutreach.filter((item) => String(item.match) === String(liveMatch.id)));
        setError("");
        setOutreachBody((current) => current || buildOutreachBody(liveMatch));
      })
      .catch(() => {
        if (!mounted) return;
        if (ENABLE_MOCK_FALLBACK) {
          const fallback = mockMatches.find((m) => m.id === id) ?? null;
          setMatch(fallback);
          if (fallback) setOutreachBody(buildOutreachBody(fallback));
          setError(
            audienceCopy(
              "Service is temporarily unavailable. Showing demo match data.",
              "Backend unavailable. Showing demo fallback match.",
            ),
          );
          return;
        }
        setError(
          audienceCopy(
            "Could not load this match right now.",
            "Could not load this match from API.",
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
  }, [id]);

  const exportReport = () => {
    if (!match) return;
    try {
      exportMatchReportPdf(match);
      setStatusMessage("PDF report exported.");
      setError("");
    } catch {
      setStatusMessage("");
      setError("Could not export PDF report.");
    }
  };

  const onSendOutreach = async () => {
    if (!match) return;
    const normalizedBody = normalizeWhitespace(outreachBody || buildOutreachBody(match));
    if (normalizedBody.length < 10) {
      setError("Please write a message with at least 10 characters before sending.");
      setStatusMessage("");
      return;
    }
    setSendingOutreach(true);
    setError("");
    setStatusMessage("");
    try {
      await sendOutreach(match.id, outreachChannel, normalizedBody);
      const [refreshed, refreshedOutreach] = await Promise.all([getMatchDetail(id), getOutreachMessages()]);
      setMatch(refreshed);
      setOutreachActivity(refreshedOutreach.filter((item) => String(item.match) === String(refreshed.id)));
      setStatusMessage(
        audienceCopy(
          "Outreach has been queued. External SMS/WhatsApp sending is currently off.",
          "Outreach queued via API. External SMS/WhatsApp sending is disabled in safe mode unless backend delivery mode is set to live.",
        ),
      );
    } catch {
      setError("Could not send outreach message.");
    } finally {
      setSendingOutreach(false);
    }
  };

  if (isInitialLoading) {
    return <MatchDetailSkeleton />;
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium text-foreground">Match not found</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link href="/coordinator/matches">Back to Matches</Link>
        </Button>
      </div>
    );
  }

  const latestOutboundMessage = [...outreachActivity]
    .filter((item) => (item.direction || "outbound") === "outbound")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const outreachDraftDone = Boolean(latestOutboundMessage) || match.outreachStatus !== "pending";
  const messageSentDone =
    match.outreachStatus === "sent" ||
    match.outreachStatus === "delivered" ||
    match.outreachStatus === "replied" ||
    Boolean(
      latestOutboundMessage &&
      ["queued", "sent", "delivered", "replied"].includes((latestOutboundMessage.status || "").toLowerCase()),
    );
  const responseDone = match.outreachStatus === "replied";

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4 gap-1">
        <Link href="/coordinator/matches">
          <ArrowLeft className="h-4 w-4" />
          Back to Matches
        </Link>
      </Button>
      {error && <p className="mb-2 text-xs text-[hsl(var(--warning))]">{error}</p>}
      {statusMessage && <p className="mb-2 text-xs text-[hsl(var(--success))]">{statusMessage}</p>}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {match.patient.name}
            </h1>
            {match.isNew && <Badge>NEW MATCH</Badge>}
            <Badge
              variant={
                match.overallStatus === "Eligible"
                  ? "default"
                  : match.overallStatus === "Possibly Eligible"
                    ? "secondary"
                    : "destructive"
              }
              className={
                match.overallStatus === "Eligible"
                  ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"
                  : match.overallStatus === "Possibly Eligible"
                    ? "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]"
                    : ""
              }
            >
              {match.overallStatus}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Matched to{" "}
            <span className="font-medium text-foreground">
              {match.trial.id}
            </span>{" "}
            &middot; Last evaluated {formatFriendlyDateTime(match.lastEvaluated, "Pending")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 bg-transparent"
            onClick={exportReport}
          >
            <FileText className="h-4 w-4" />
            Export Report
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onSendOutreach} disabled={sendingOutreach}>
            <Send className="h-4 w-4" />
            {sendingOutreach ? "Sending..." : "Send Outreach"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ScoreCard
          label="Eligibility Fit"
          score={match.eligibilityScore}
          icon={TrendingUp}
          description="Based on inclusion/exclusion criteria evaluation"
        />
        <ScoreCard
          label="Feasibility Fit"
          score={match.feasibilityScore}
          icon={MapPin}
          description="Distance, visit burden, patient constraints"
        />
        <UrgencyCard urgency={match.urgencyFlag} />
      </div>

      <Card className="mt-4 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {SHOW_TECHNICAL_COPY ? "LLM Match Explanation" : "AI Match Explanation"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground">
            {match.explanationSummary ||
              audienceCopy(
                "This match summary was generated by AI to support coordinator review. Final eligibility always requires coordinator and clinician review.",
                "This match was evaluated using rule-based and language-model assistance. Final eligibility requires coordinator and clinician review.",
              )}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">
              Confidence: {formatConfidence(match.confidence)}
            </Badge>
            {SHOW_TECHNICAL_COPY && (
              <>
                <Badge variant="outline">
                  Model: {match.explanationModel || "deterministic-fallback"}
                </Badge>
                <Badge variant="outline">
                  Prompt: {match.promptVersion || "v1"}
                </Badge>
              </>
            )}
            {match.explanationModel?.includes("fallback") && (
              <Badge variant="secondary">
                {SHOW_TECHNICAL_COPY ? "Safe fallback explanation" : "Automated backup summary"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="eligibility" className="mt-8">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="eligibility" className="gap-1.5">
            <Stethoscope className="h-4 w-4" />
            Eligibility
          </TabsTrigger>
          <TabsTrigger value="patient" className="gap-1.5">
            <User className="h-4 w-4" />
            Patient
          </TabsTrigger>
          <TabsTrigger value="trial" className="gap-1.5">
            <FlaskConical className="h-4 w-4" />
            Trial
          </TabsTrigger>
          <TabsTrigger value="outreach" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Outreach
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eligibility" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                  Criteria Met ({match.reasonsMatched.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {match.reasonsMatched.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
                      <span className="text-sm text-foreground">{reason}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {match.reasonsFailed.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Criteria Not Met ({match.reasonsFailed.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {match.reasonsFailed.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          <span className="text-sm text-foreground">
                            {reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="h-4 w-4 text-[hsl(var(--warning))]" />
                    Missing Information ({match.missingInfo.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {match.missingInfo.map((info, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
                        <span className="text-sm text-foreground">{info}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5 bg-transparent">
                    <Send className="h-3.5 w-3.5" />
                    Request Info from Patient
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-4 w-4 text-primary" />
                Doctor Checklist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {match.doctorChecklist.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm text-foreground">{item}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patient" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Patient Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {match.patient.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {match.patient.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {match.patient.age} y/o {match.patient.sex} &middot;{" "}
                        {match.patient.city}, {match.patient.country}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <InfoField label="Diagnosis" value={match.patient.diagnosis} />
                    <InfoField label="Stage" value={match.patient.stage} />
                    <InfoField label="Language" value={match.patient.language} />
                    <InfoField
                      label="Contact Channel"
                      value={match.patient.contactChannel.toUpperCase()}
                    />
                    <InfoField
                      label="Contact"
                      value={match.patient.contactInfo}
                    />
                    <InfoField
                      label="Registered"
                      value={formatFriendlyDate(match.patient.registeredAt, "Unknown")}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Profile Completeness
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress
                        value={match.patient.profileCompleteness}
                        className="h-2 flex-1"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {match.patient.profileCompleteness}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Patient Story</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    {match.patient.story}
                  </p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {SHOW_TECHNICAL_COPY
                    ? "This narrative was used by the AI to extract the structured patient profile and generate match evaluations. Structured fields are derived from this text using LLM extraction."
                    : "This is the patient's shared medical story. AI uses it to support matching, and coordinators review all results before any next steps."}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trial" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {match.trial.id}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {match.trial.source === "pakistan_ctr"
                        ? "Pakistan CTR"
                        : "ClinicalTrials.gov"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {match.trial.title}
                  </p>
                </div>
                <Badge
                  className={
                    match.trial.status === "RECRUITING"
                      ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"
                      : "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]"
                  }
                >
                  {match.trial.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <InfoField label="Phase" value={match.trial.phase} />
                  <InfoField label="Sponsor" value={match.trial.sponsor} />
                  <InfoField
                    label="Conditions"
                    value={match.trial.conditions.join(", ")}
                  />
                  <InfoField
                    label="Interventions"
                    value={match.trial.interventions.join(", ")}
                  />
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Summary
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {match.trial.summary}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Eligibility Summary
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {match.trial.eligibilitySummary}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Trial Sites
                  </p>
                  <div className="mt-2 space-y-2">
                    {match.trial.locations.map((loc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2"
                      >
                        <MapPin className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {loc.facility}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {loc.city}, {loc.country}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outreach" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Outreach Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-4 border-l-2 border-border pl-6">
                  <TimelineItem
                    label="Match Identified"
                    date={formatTimelineDate(match.lastEvaluated)}
                    dateTitle={formatFriendlyDateTime(match.lastEvaluated, "Pending")}
                    status="done"
                    description="AI matching system identified this patient-trial pair"
                  />
                  <TimelineItem
                    label="Outreach Draft"
                    date={
                      outreachDraftDone
                        ? formatTimelineDate(latestOutboundMessage?.created_at || match.lastEvaluated)
                        : "Pending"
                    }
                    dateTitle={
                      outreachDraftDone
                        ? formatFriendlyDateTime(latestOutboundMessage?.created_at || match.lastEvaluated, "Pending")
                        : "Pending"
                    }
                    status={
                      outreachDraftDone ? "done" : "pending"
                    }
                    description="Coordinator prepares multilingual outreach message"
                  />
                  <TimelineItem
                    label="Message Sent"
                    date={
                      messageSentDone
                        ? formatTimelineDate(
                            latestOutboundMessage?.sent_at ||
                              latestOutboundMessage?.created_at ||
                              match.lastEvaluated,
                          )
                        : "Not sent"
                    }
                    dateTitle={
                      messageSentDone
                        ? formatFriendlyDateTime(
                            latestOutboundMessage?.sent_at ||
                              latestOutboundMessage?.created_at ||
                              match.lastEvaluated,
                            "Pending",
                          )
                        : "Not sent"
                    }
                    status={
                      messageSentDone ? "done" : "pending"
                    }
                    description={`Via ${(latestOutboundMessage?.channel || outreachChannel).toUpperCase()}`}
                  />
                  <TimelineItem
                    label="Patient Response"
                    date={
                      responseDone
                        ? "Received"
                        : "Awaiting"
                    }
                    status={
                      responseDone ? "done" : "pending"
                    }
                    description="Patient confirms interest and provides additional info"
                  />
                  <TimelineItem
                    label="Doctor Review"
                    date="Pending"
                    status="pending"
                    description="Physician reviews match and confirms eligibility"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Draft Outreach Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={outreachChannel === "whatsapp" ? "default" : "outline"}
                      className="gap-1.5 text-xs"
                      onClick={() => setOutreachChannel("whatsapp")}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant={outreachChannel === "sms" ? "default" : "outline"}
                      className="gap-1.5 text-xs"
                      onClick={() => setOutreachChannel("sms")}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      SMS
                    </Button>
                    <Button
                      size="sm"
                      variant={outreachChannel === "email" ? "default" : "outline"}
                      className="gap-1.5 text-xs"
                      onClick={() => setOutreachChannel("email")}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </Button>
                    <Button
                      size="sm"
                      variant={outreachChannel === "phone" ? "default" : "outline"}
                      className="gap-1.5 text-xs"
                      onClick={() => setOutreachChannel("phone")}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Phone
                    </Button>
                  </div>

                  <Textarea value={outreachBody} onChange={(e) => setOutreachBody(e.target.value)} rows={10} />

                  <div className="flex gap-2">
                    <Button className="flex-1 gap-1.5" onClick={onSendOutreach} disabled={sendingOutreach}>
                      <Send className="h-4 w-4" />
                      {sendingOutreach
                        ? "Sending..."
                        : `Send via ${outreachChannel.charAt(0).toUpperCase() + outreachChannel.slice(1)}`}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function buildOutreachBody(match: MatchEvaluation): string {
  return [
    `Dear ${match.patient.name},`,
    "",
    `We are writing from ${match.trial.locations[0]?.facility || "your hospital"} regarding a clinical trial that may be relevant to your condition (${match.patient.diagnosis}).`,
    "",
    `The trial (${match.trial.id}) is studying ${match.trial.interventions.join(" and ")} for patients with ${match.trial.conditions[0] || "similar conditions"}. Based on your profile, you may be eligible to participate.`,
    "",
    "Participation is voluntary. Final eligibility always requires physician review.",
    "",
    "If you are interested, please reply to this message.",
  ].join("\n");
}

function formatConfidence(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function formatTimelineDate(value?: string | null): string {
  if (!value) return "Pending";
  const relative = formatRelativeUpdate(value, "Recently");
  if (!relative) return "Recently";
  if (relative === "just now") return "Just now";
  return relative.charAt(0).toUpperCase() + relative.slice(1);
}

function exportMatchReportPdf(match: MatchEvaluation) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const palette = {
    pageBg: "#F3F7F7",
    cardBg: "#FFFFFF",
    cardBorder: "#D5E2E0",
    primary: "#2F9F95",
    primarySoft: "#EAF7F5",
    textStrong: "#17212B",
    textMuted: "#667A86",
    success: "#1F9A6C",
    warning: "#C26A17",
    danger: "#D84040",
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 13;
  let y = margin;

  const setFill = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
  };
  const setStroke = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    doc.setDrawColor(r, g, b);
  };
  const setText = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    doc.setTextColor(r, g, b);
  };
  const ensureSpace = (heightNeeded: number) => {
    if (y + heightNeeded <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };
  const drawCard = (x: number, top: number, w: number, h: number, fill = palette.cardBg) => {
    setFill(fill);
    setStroke(palette.cardBorder);
    doc.roundedRect(x, top, w, h, 10, 10, "FD");
  };
  const wrapLines = (text: string, maxWidth: number): string[] =>
    (doc.splitTextToSize(text, maxWidth) as string[]).filter(Boolean);
  const drawKeyValue = (x: number, top: number, key: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(palette.textMuted);
    doc.text(key, x, top);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(palette.textStrong);
    const lines = wrapLines(value, 220);
    doc.text(lines, x, top + 15);
  };

  setFill(palette.pageBg);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  ensureSpace(82);
  drawCard(margin, y, contentWidth, 82, palette.primarySoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  setText(palette.textStrong);
  doc.text("TrialBridge Match Report", margin + 16, y + 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(palette.textMuted);
  doc.text(`Generated ${formatFriendlyDateTime(new Date().toISOString(), "Now")}`, margin + 16, y + 48);
  doc.text(`Match ID: ${match.id}`, margin + 16, y + 63);
  y += 98;

  ensureSpace(124);
  drawCard(margin, y, contentWidth, 124);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  setText(palette.textStrong);
  doc.text(match.patient.name, margin + 16, y + 30);

  const statusLabel = match.overallStatus;
  const statusColor =
    match.overallStatus === "Eligible"
      ? palette.success
      : match.overallStatus === "Possibly Eligible"
        ? palette.warning
        : palette.danger;
  const badgeW = doc.getTextWidth(statusLabel) + 20;
  setFill(statusColor);
  doc.roundedRect(margin + contentWidth - badgeW - 16, y + 16, badgeW, 20, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText("#FFFFFF");
  doc.text(statusLabel, margin + contentWidth - badgeW - 6, y + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(palette.textMuted);
  const subtitle = `Matched to ${match.trial.id} • Last evaluated ${formatFriendlyDateTime(match.lastEvaluated, "Pending")}`;
  doc.text(subtitle, margin + 16, y + 49);

  drawKeyValue(margin + 16, y + 72, "Diagnosis", match.patient.diagnosis || "Not provided");
  drawKeyValue(
    margin + contentWidth / 2,
    y + 72,
    "Location",
    `${match.patient.city}, ${match.patient.country}`,
  );
  y += 140;

  const gap = 10;
  const scoreCardW = (contentWidth - gap * 2) / 3;
  const scoreCardH = 108;
  ensureSpace(scoreCardH + 12);
  drawScorePdfCard(doc, margin, y, scoreCardW, scoreCardH, "Eligibility Fit", match.eligibilityScore, palette);
  drawScorePdfCard(
    doc,
    margin + scoreCardW + gap,
    y,
    scoreCardW,
    scoreCardH,
    "Feasibility Fit",
    match.feasibilityScore,
    palette,
  );
  drawUrgencyPdfCard(
    doc,
    margin + (scoreCardW + gap) * 2,
    y,
    scoreCardW,
    scoreCardH,
    match.urgencyFlag,
    palette,
  );
  y += scoreCardH + 14;

  const explanation = match.explanationSummary?.trim()
    ? match.explanationSummary
    : "Potential match identified. Coordinator and physician review is required before enrollment.";
  const explanationLines = wrapLines(explanation, contentWidth - 32);
  const explanationTextTopOffset = 45;
  const explanationTextHeight = explanationLines.length * lineHeight;
  const explanationChipTopOffset = explanationTextTopOffset + explanationTextHeight + 10;
  const explanationHeight = Math.max(112, explanationChipTopOffset + 22 + 14);
  ensureSpace(explanationHeight + 12);
  drawCard(margin, y, contentWidth, explanationHeight, palette.primarySoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(palette.textStrong);
  doc.text("AI Match Explanation", margin + 16, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(palette.textStrong);
  doc.text(explanationLines, margin + 16, y + explanationTextTopOffset, { maxWidth: contentWidth - 32 });

  const confidenceChip = `Confidence: ${formatConfidence(match.confidence)}`;
  drawPdfChip(doc, margin + 16, y + explanationChipTopOffset, confidenceChip, palette);
  y += explanationHeight + 14;

  const criteriaItems = match.reasonsMatched.length ? match.reasonsMatched : ["No confirmed criteria yet."];
  const missingItems = match.missingInfo.length ? match.missingInfo : ["No missing information flagged."];

  const listCardGap = 10;
  const listCardW = (contentWidth - listCardGap) / 2;
  const criteriaH = estimateBulletCardHeight(doc, `Criteria Met (${criteriaItems.length})`, criteriaItems, listCardW - 32, lineHeight);
  const missingH = estimateBulletCardHeight(
    doc,
    `Missing Information (${missingItems.length})`,
    missingItems,
    listCardW - 32,
    lineHeight,
  );
  const listRowH = Math.max(criteriaH, missingH);
  ensureSpace(listRowH + 12);
  drawBulletPdfCard(
    doc,
    margin,
    y,
    listCardW,
    listRowH,
    `Criteria Met (${criteriaItems.length})`,
    criteriaItems,
    palette.success,
    palette,
  );
  drawBulletPdfCard(
    doc,
    margin + listCardW + listCardGap,
    y,
    listCardW,
    listRowH,
    `Missing Information (${missingItems.length})`,
    missingItems,
    palette.warning,
    palette,
  );
  y += listRowH + 14;

  const checklistItems = match.doctorChecklist.length ? match.doctorChecklist : ["Coordinator review in progress."];
  const checklistH = estimateBulletCardHeight(doc, "Doctor Checklist", checklistItems, contentWidth - 32, lineHeight);
  ensureSpace(checklistH + 12);
  drawBulletPdfCard(doc, margin, y, contentWidth, checklistH, "Doctor Checklist", checklistItems, palette.primary, palette);
  y += checklistH + 14;

  const trialSummaryText = [
    `Title: ${match.trial.title}`,
    `Phase: ${match.trial.phase}`,
    `Status: ${match.trial.status.replace(/_/g, " ")}`,
    `Sponsor: ${match.trial.sponsor}`,
    `Sites: ${
      match.trial.locations.length
        ? match.trial.locations.map((site) => `${site.facility} (${site.city}, ${site.country})`).join("; ")
        : "Not listed"
    }`,
  ];
  const patientSummaryText = [
    `Age/Sex: ${match.patient.age} years, ${match.patient.sex}`,
    `Contact: ${match.patient.contactChannel.toUpperCase()} ${match.patient.contactInfo}`,
    `Stage: ${match.patient.stage || "Not provided"}`,
    `Profile completeness: ${match.patient.profileCompleteness}%`,
  ];

  const summaryCardW = (contentWidth - listCardGap) / 2;
  const patientSummaryH = estimateParagraphCardHeight(doc, "Patient Snapshot", patientSummaryText, summaryCardW - 32, lineHeight);
  const trialSummaryH = estimateParagraphCardHeight(doc, "Trial Snapshot", trialSummaryText, summaryCardW - 32, lineHeight);
  const summaryRowH = Math.max(patientSummaryH, trialSummaryH);
  ensureSpace(summaryRowH + 12);
  drawParagraphPdfCard(doc, margin, y, summaryCardW, summaryRowH, "Patient Snapshot", patientSummaryText, palette);
  drawParagraphPdfCard(
    doc,
    margin + summaryCardW + listCardGap,
    y,
    summaryCardW,
    summaryRowH,
    "Trial Snapshot",
    trialSummaryText,
    palette,
  );

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(palette.textMuted);
    doc.text("TrialBridge • Confidential", margin, pageHeight - 14);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin - 52, pageHeight - 14);
  }

  doc.save(`trialbridge-match-${match.id}.pdf`);
}

function drawScorePdfCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  score: number,
  palette: Record<string, string>,
) {
  drawPdfBaseCard(doc, x, y, width, height, palette);
  const scoreColor = score >= 80 ? palette.success : score >= 60 ? palette.warning : palette.danger;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setPdfTextColor(doc, palette.textMuted);
  doc.text(label.toUpperCase(), x + 14, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  setPdfTextColor(doc, scoreColor);
  doc.text(String(Math.round(score)), x + 14, y + 56);
}

function drawUrgencyPdfCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  urgency: "high" | "medium" | "low",
  palette: Record<string, string>,
) {
  drawPdfBaseCard(doc, x, y, width, height, palette);
  const config = {
    high: { label: "High Urgency", color: palette.danger, note: "Needs faster coordinator action" },
    medium: { label: "Medium Urgency", color: palette.warning, note: "Review soon and confirm details" },
    low: { label: "Low Urgency", color: palette.success, note: "Stable timing for coordinator review" },
  } as const;
  const current = config[urgency];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setPdfTextColor(doc, palette.textMuted);
  doc.text("URGENCY", x + 14, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  setPdfTextColor(doc, current.color);
  doc.text(current.label, x + 14, y + 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setPdfTextColor(doc, palette.textMuted);
  const noteLines = doc.splitTextToSize(current.note, width - 28) as string[];
  doc.text(noteLines, x + 14, y + 69);
}

function drawPdfChip(doc: jsPDF, x: number, yTop: number, text: string, palette: Record<string, string>) {
  const chipW = doc.getTextWidth(text) + 18;
  setPdfFillColor(doc, "#FFFFFF");
  setPdfStrokeColor(doc, palette.cardBorder);
  doc.roundedRect(x, yTop, chipW, 22, 9, 9, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setPdfTextColor(doc, palette.textStrong);
  doc.text(text, x + 9, yTop + 14);
}

function estimateBulletCardHeight(doc: jsPDF, title: string, items: string[], maxWidth: number, lineHeight: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  let lines = 0;
  items.forEach((item) => {
    lines += Math.max(1, (doc.splitTextToSize(item, maxWidth) as string[]).length);
  });
  const titleHeight = 24;
  const listHeight = lines * lineHeight + Math.max(0, items.length - 1) * 6;
  const total = titleHeight + 14 + listHeight + 16;
  return Math.max(total, 110);
}

function drawBulletPdfCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  items: string[],
  bulletColor: string,
  palette: Record<string, string>,
) {
  drawPdfBaseCard(doc, x, y, width, height, palette);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setPdfTextColor(doc, palette.textStrong);
  doc.text(title, x + 14, y + 24);

  let cursorY = y + 42;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  items.forEach((item) => {
    const lines = doc.splitTextToSize(item, width - 38) as string[];
    setPdfFillColor(doc, bulletColor);
    doc.circle(x + 16, cursorY - 3, 2.1, "F");
    setPdfTextColor(doc, palette.textStrong);
    doc.text(lines, x + 24, cursorY);
    cursorY += lines.length * 13 + 6;
  });
}

function estimateParagraphCardHeight(
  doc: jsPDF,
  title: string,
  rows: string[],
  maxWidth: number,
  lineHeight: number,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  let lines = 0;
  rows.forEach((row) => {
    lines += Math.max(1, (doc.splitTextToSize(row, maxWidth) as string[]).length);
  });
  const total = 24 + 12 + lines * lineHeight + (rows.length - 1) * 4 + 14;
  return Math.max(total, 110);
}

function drawParagraphPdfCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  rows: string[],
  palette: Record<string, string>,
) {
  drawPdfBaseCard(doc, x, y, width, height, palette);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setPdfTextColor(doc, palette.textStrong);
  doc.text(title, x + 14, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setPdfTextColor(doc, palette.textStrong);
  let cursorY = y + 43;
  rows.forEach((row) => {
    const lines = doc.splitTextToSize(row, width - 28) as string[];
    doc.text(lines, x + 14, cursorY);
    cursorY += lines.length * 13 + 4;
  });
}

function drawPdfBaseCard(doc: jsPDF, x: number, y: number, width: number, height: number, palette: Record<string, string>) {
  setPdfFillColor(doc, palette.cardBg);
  setPdfStrokeColor(doc, palette.cardBorder);
  doc.roundedRect(x, y, width, height, 10, 10, "FD");
}

function setPdfFillColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setPdfStrokeColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

function setPdfTextColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const normalized = raw.length === 3 ? raw.split("").map((char) => `${char}${char}`).join("") : raw;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return [r, g, b];
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ScoreCard({
  label,
  score,
  icon: Icon,
  description,
}: {
  label: string;
  score: number;
  icon: React.ElementType;
  description: string;
}) {
  const color =
    score >= 80
      ? "text-[hsl(var(--success))]"
      : score >= 60
        ? "text-[hsl(var(--warning))]"
        : "text-destructive";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
        <p className={`mt-2 text-4xl font-bold ${color}`}>{score}</p>
        <Progress
          value={score}
          className="mt-3 h-1.5"
        />
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function UrgencyCard({ urgency }: { urgency: "high" | "medium" | "low" }) {
  const config = {
    high: {
      label: "High Urgency",
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      description: "Disease progressing, limited treatment options remaining",
    },
    medium: {
      label: "Medium Urgency",
      icon: Clock,
      color: "text-[hsl(var(--warning))]",
      bg: "bg-[hsl(var(--warning)/0.1)]",
      description: "Standard urgency, trial enrollment window open",
    },
    low: {
      label: "Low Urgency",
      icon: CheckCircle2,
      color: "text-[hsl(var(--success))]",
      bg: "bg-[hsl(var(--success)/0.1)]",
      description: "Stable condition, can consider trial at patient's pace",
    },
  };

  const c = config[urgency];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <c.icon className={`h-4 w-4 ${c.color}`} />
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Urgency
          </p>
        </div>
        <p className={`mt-2 text-xl font-bold ${c.color}`}>{c.label}</p>
        <div className={`mt-3 rounded-md px-3 py-2 ${c.bg}`}>
          <p className="text-xs text-foreground">{c.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineItem({
  label,
  date,
  dateTitle,
  status,
  description,
}: {
  label: string;
  date: string;
  dateTitle?: string;
  status: "done" | "pending";
  description: string;
}) {
  return (
    <div className="relative">
      <div
        className={`absolute -left-[30px] top-0.5 h-3 w-3 rounded-full border-2 ${
          status === "done"
            ? "border-primary bg-primary"
            : "border-muted-foreground/30 bg-background"
        }`}
      />
      <div>
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-medium ${status === "done" ? "text-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </p>
          <span className="text-xs text-muted-foreground" title={dateTitle || date}>
            {date}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
