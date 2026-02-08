"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ENABLE_MOCK_FALLBACK,
  getMatches,
  type OutreachMessageItem,
  getOutreachMessages,
  sendOutreach,
} from "@/lib/api";
import { audienceCopy } from "@/lib/dev-mode";
import { formatFriendlyDateTime } from "@/lib/date";
import { normalizeWhitespace } from "@/lib/validation";

function OutreachSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-64" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`outreach-skeleton-${idx}`} className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="mt-2 h-3 w-72" />
              <Skeleton className="mt-2 h-3 w-40" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OutreachPage() {
  const [messages, setMessages] = useState<OutreachMessageItem[]>([]);
  const [draft, setDraft] = useState("Hello, we found a potential clinical trial match for you.");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    getOutreachMessages()
      .then((items) => {
        if (!mounted) return;
        setMessages(items);
        setError("");
      })
      .catch(() => {
        if (!mounted) return;
        if (ENABLE_MOCK_FALLBACK) {
          setMessages([]);
          setError(
            audienceCopy(
              "Service is temporarily unavailable. Outreach history is not available in demo mode.",
              "Backend unavailable. Outreach list is empty in fallback mode.",
            ),
          );
          return;
        }
        setError("Could not load outreach activity.");
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
    return <OutreachSkeleton />;
  }

  const sendDemo = async () => {
    const normalizedDraft = normalizeWhitespace(draft);
    if (normalizedDraft.length < 10) {
      setStatusMessage("");
      setError("Please write a message with at least 10 characters.");
      return;
    }
    try {
      const liveMatches = await getMatches();
      const first = liveMatches[0];
      if (!first) {
        setStatusMessage("");
        setError("No matched patients are available to queue outreach.");
        return;
      }
      await sendOutreach(first.id, "email", normalizedDraft);
      const refreshed = await getOutreachMessages();
      setMessages(refreshed);
      setStatusMessage(
        audienceCopy(
          "Message queued. External SMS/WhatsApp sending is currently off.",
          "Message queued via API (external SMS/WhatsApp sending is disabled in safe mode).",
        ),
      );
      setError("");
    } catch {
      setStatusMessage("");
      setError("Could not queue outreach message.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Outreach Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track outbound patient communication across SMS and WhatsApp.
        </p>
        {error && <p className="mt-2 text-xs text-[hsl(var(--warning))]">{error}</p>}
        {statusMessage && <p className="mt-2 text-xs text-[hsl(var(--success))]">{statusMessage}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Queue (Safe Mode)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button onClick={sendDemo}>Queue Email to First Matched Patient</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outreach messages yet.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className="rounded-lg border border-border/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {m.patient_name} · {m.trial_id}
                    </p>
                    <Badge variant="outline" className="capitalize">
                      {m.channel}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Status: {m.status} · {formatFriendlyDateTime(m.created_at, "Unknown")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
