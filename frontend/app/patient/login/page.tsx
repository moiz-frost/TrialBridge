"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patientAccess } from "@/lib/api";
import { getPatientSession, setPatientSession } from "@/lib/patient-session";

export default function PatientLoginPage() {
  const router = useRouter();
  const [patientCode, setPatientCode] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = getPatientSession();
    if (existing) {
      router.replace("/patient/portal");
    }
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const normalizedCode = patientCode.trim().toUpperCase();
    const normalizedContact = contactInfo.trim();
    if (!normalizedCode) {
      setError("Please enter your patient code.");
      return;
    }
    if (!normalizedContact) {
      setError("Please enter the same phone/email you used in intake.");
      return;
    }
    setLoading(true);
    try {
      const result = await patientAccess(normalizedCode, normalizedContact);
      setPatientSession(String(result.patient_id), result.patient_code, result.name || "Patient");
      router.replace("/patient/portal");
    } catch {
      setError("Could not verify patient access. Check patient code/contact info and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">TrialBridge</span>
          </div>
          <CardTitle className="text-xl">Patient Portal Access</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="patient-code">Patient Code</Label>
              <Input
                id="patient-code"
                placeholder="e.g. PAT-0006"
                value={patientCode}
                onChange={(e) => setPatientCode(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="contact-info">Contact Info</Label>
              <Input
                id="contact-info"
                placeholder="Phone or email used in intake"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use the same phone/email from intake. International and local phone formats are accepted.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Verifying..." : "Open My Portal"}
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Need to register first?{" "}
            <Link href="/patient/intake" className="text-primary underline">
              Submit intake
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
