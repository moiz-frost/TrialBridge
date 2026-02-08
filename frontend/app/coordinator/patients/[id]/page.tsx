"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ENABLE_MOCK_FALLBACK,
  getCoordinatorPatientDetail,
  type CoordinatorPatientDetail,
  type PatientDocumentItem,
} from "@/lib/api";
import { audienceCopy } from "@/lib/dev-mode";
import { formatFriendlyDate, formatFriendlyDateTime } from "@/lib/date";
import { mockMatches, mockPatients } from "@/lib/mock-data";
import {
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  UserRound,
} from "lucide-react";

function PatientDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-44" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-5/6" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={`doc-row-${idx}`} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function contactIcon(channel: string) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5" />;
  if (channel === "phone") return <Phone className="h-3.5 w-3.5" />;
  return <MessageSquare className="h-3.5 w-3.5" />;
}

function documentStatusBadge(status: PatientDocumentItem["extraction_status"]) {
  if (status === "extracted") return <Badge className="bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]">Text Extracted</Badge>;
  if (status === "empty") return <Badge variant="secondary">No Text Found</Badge>;
  if (status === "unsupported") return <Badge variant="outline">Unsupported Type</Badge>;
  if (status === "failed") return <Badge variant="destructive">Extraction Failed</Badge>;
  return <Badge variant="outline">Queued</Badge>;
}

function historyEntrySourceLabel(source: string) {
  if (source === "intake") return "Initial Intake";
  if (source === "patient_portal") return "Patient Added";
  if (source === "coordinator") return "Coordinator Added";
  return "History Entry";
}

function toFallbackDetail(id: string): CoordinatorPatientDetail | null {
  const fallbackPatient = mockPatients.find((p) => String(p.id) === id) || mockPatients[0];
  if (!fallbackPatient) return null;
  const matches = mockMatches.filter((m) => String(m.patient.id) === String(fallbackPatient.id));
  return {
    patient: fallbackPatient,
    matches,
    documents: [],
    historyEntries: [],
  };
}

export default function CoordinatorPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<CoordinatorPatientDetail | null>(null);
  const [error, setError] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [expandedDocuments, setExpandedDocuments] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    getCoordinatorPatientDetail(id)
      .then((detail) => {
        if (!mounted) return;
        setData(detail);
        setError("");
      })
      .catch(() => {
        if (!mounted) return;
        if (ENABLE_MOCK_FALLBACK) {
          setData(toFallbackDetail(id));
          setError(
            audienceCopy(
              "Service is temporarily unavailable. Showing demo patient detail.",
              "Backend unavailable. Showing demo fallback patient detail.",
            ),
          );
          return;
        }
        setError(
          audienceCopy(
            "Could not load patient details right now.",
            "Could not load patient details from API.",
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

  const topMatches = useMemo(() => (data?.matches || []).slice(0, 6), [data?.matches]);

  if (isInitialLoading) {
    return <PatientDetailSkeleton />;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="gap-1">
          <Link href="/coordinator/patients">
            <ArrowLeft className="h-4 w-4" />
            Back to Patients
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="gap-1">
          <Link href="/coordinator/patients">
            <ArrowLeft className="h-4 w-4" />
            Back to Patients
          </Link>
        </Button>
      </div>

      {error && <p className="text-xs text-[hsl(var(--warning))]">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Patient Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <UserRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{data.patient.name}</p>
                <p className="text-xs text-muted-foreground">
                  {data.patient.age}y, {data.patient.sex} · {data.patient.language}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="text-sm">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Diagnosis</p>
                <p className="font-medium text-foreground">{data.patient.diagnosis || "Not provided"}</p>
              </div>
              <div className="text-sm">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Stage</p>
                <p className="font-medium text-foreground">{data.patient.stage || "Not provided"}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {data.patient.city}, {data.patient.country}
              </p>
              <p className="flex items-center gap-2">
                {contactIcon(data.patient.contactChannel)}
                {data.patient.contactChannel.toUpperCase()}: {data.patient.contactInfo}
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Registered {formatFriendlyDate(data.patient.registeredAt, "Unknown")}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Profile Completeness</span>
                <span className="font-semibold text-foreground">{data.patient.profileCompleteness}%</span>
              </div>
              <Progress value={data.patient.profileCompleteness} className="mt-1.5 h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Patient Story</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
              {data.patient.story || "No story submitted."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Medical History Log ({data.historyEntries.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history entries have been recorded yet.</p>
          ) : (
            data.historyEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border/60 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {historyEntrySourceLabel(entry.source)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatFriendlyDateTime(entry.created_at, "Unknown time")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entry.entry_text}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Uploaded Documents & Extracted Text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            data.documents.map((doc) => {
              const expanded = Boolean(expandedDocuments[doc.id]);
              const fullText = (doc.extracted_text || "").trim();
              const previewText = (doc.extracted_text_preview || "").trim();
              const canExpand =
                Boolean(fullText) &&
                doc.extracted_text_chars > previewText.replace(/\.\.\.$/, "").length;

              return (
                <div key={doc.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{doc.original_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatFriendlyDateTime(doc.created_at, "Unknown")} · {Math.max(1, Math.round(doc.size_bytes / 1024))} KB
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {documentStatusBadge(doc.extraction_status)}
                      {doc.file_url && (
                        <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                            Open
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 rounded-md bg-muted/40 p-3">
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Extracted Text
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {expanded ? fullText || "No extracted text available." : previewText || fullText || "No extracted text available."}
                    </p>
                    {doc.extraction_error && (
                      <p className="mt-2 text-xs text-[hsl(var(--warning))]">{doc.extraction_error}</p>
                    )}
                    {canExpand && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 px-0 text-xs text-primary hover:bg-transparent"
                        onClick={() =>
                          setExpandedDocuments((prev) => ({
                            ...prev,
                            [doc.id]: !prev[doc.id],
                          }))
                        }
                      >
                        {expanded ? "Show less" : "Show full text"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Matched Trials ({topMatches.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches available yet.</p>
          ) : (
            topMatches.map((match) => (
              <Link
                key={match.id}
                href={`/coordinator/matches/${match.id}`}
                className="block rounded-md border border-border/60 px-3 py-2 transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium text-foreground">
                  {match.trial.id} · {match.trial.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  Eligibility {match.eligibilityScore} · Feasibility {match.feasibilityScore}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
