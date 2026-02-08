"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  MapPin,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  User,
} from "lucide-react";
import { mockPatients } from "@/lib/mock-data";
import { ENABLE_MOCK_FALLBACK, getPatients } from "@/lib/api";
import { audienceCopy } from "@/lib/dev-mode";
import { formatFriendlyDate } from "@/lib/date";

const contactIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-3 w-3" />,
  phone: <Phone className="h-3 w-3" />,
  sms: <MessageSquare className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
};

function PatientsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-36" />

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Card key={`patient-skeleton-${idx}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2 w-full" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<typeof mockPatients>([]);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    getPatients()
      .then((livePatients) => {
        if (!mounted) return;
        setPatients(livePatients);
        setError("");
      })
      .catch(() => {
        if (!mounted) return;
        if (ENABLE_MOCK_FALLBACK) {
          setPatients(mockPatients);
          setError(
            audienceCopy(
              "Service is temporarily unavailable. Showing demo patient data.",
              "Backend unavailable. Showing demo fallback patients.",
            ),
          );
          return;
        }
        setError(
          audienceCopy(
            "Could not load patients right now.",
            "Could not load patients from API.",
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
    return <PatientsSkeleton />;
  }

  const filtered = patients.filter(
    (p) =>
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Patients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View all registered patients and their profile completeness.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, diagnosis, or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
        patients registered
      </p>
      {error && <p className="text-xs text-[hsl(var(--warning))]">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((patient) => (
          <Link key={patient.id} href={`/coordinator/patients/${patient.id}`} className="block">
            <Card className="transition-all hover:border-primary/20 hover:shadow-md hover:shadow-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {patient.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {patient.age}y, {patient.sex} &middot; {patient.language}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {patient.city}, {patient.country}
                  </div>
                  <div>
                    <Badge variant="secondary" className="text-[10px]">
                      {patient.diagnosis}
                    </Badge>
                    <Badge variant="outline" className="ml-1.5 text-[10px]">
                      {patient.stage}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Profile Completeness
                    </span>
                    <span className="font-semibold text-foreground">
                      {patient.profileCompleteness}%
                    </span>
                  </div>
                  <Progress
                    value={patient.profileCompleteness}
                    className="mt-1.5 h-1.5"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {contactIcons[patient.contactChannel]}
                    {patient.contactChannel.charAt(0).toUpperCase() +
                      patient.contactChannel.slice(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Registered {formatFriendlyDate(patient.registeredAt, "Unknown")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="mt-4 text-base font-semibold text-foreground">
              No patients found
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search query.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
