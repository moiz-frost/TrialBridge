"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Upload,
  Heart,
  Sparkles,
} from "lucide-react";
import {
  ENABLE_MOCK_FALLBACK,
  submitPatientIntake,
  uploadPatientDocument,
} from "@/lib/api";
import { SHOW_TECHNICAL_COPY, audienceCopy } from "@/lib/dev-mode";
import { setPatientSession } from "@/lib/patient-session";
import {
  normalizeWhitespace,
  validateContactInfo,
  validateNarrativeText,
  normalizePhoneDigits,
} from "@/lib/validation";

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Basic Info", "Medical Story", "Contact", "Review"] as const;
const PHONE_COUNTRY_CODES = [
  { value: "+92", label: "Pakistan (+92)" },
  { value: "+971", label: "UAE (+971)" },
  { value: "+966", label: "Saudi Arabia (+966)" },
  { value: "+968", label: "Oman (+968)" },
  { value: "+973", label: "Bahrain (+973)" },
  { value: "+974", label: "Qatar (+974)" },
  { value: "+965", label: "Kuwait (+965)" },
  { value: "+91", label: "India (+91)" },
  { value: "+1", label: "US/Canada (+1)" },
  { value: "+44", label: "UK (+44)" },
] as const;

function composeContactInfo(channel: string, contactInfo: string, countryCode: string): string {
  const normalizedContact = normalizeWhitespace(contactInfo);
  if (!normalizedContact) {
    return "";
  }

  if (channel === "email") {
    return normalizedContact;
  }

  const digitsOnly = normalizePhoneDigits(normalizedContact);
  if (!digitsOnly) {
    return "";
  }

  if (normalizedContact.startsWith("+") || normalizedContact.startsWith("00")) {
    return `+${digitsOnly}`;
  }

  const codeDigits = normalizePhoneDigits(countryCode);
  const localDigits = digitsOnly.replace(/^0+/, "");
  if (localDigits.startsWith(codeDigits)) {
    return `+${localDigits}`;
  }

  return `+${codeDigits}${localDigits || digitsOnly}`;
}

export default function PatientIntakePage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepError, setStepError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    sex: "",
    city: "",
    country: "",
    language: "",
    contactChannel: "",
    contactCountryCode: "+92",
    contactInfo: "",
    story: "",
    consent: false,
  });

  const clampedStep = Math.max(1, Math.min(step, TOTAL_STEPS));
  const progress = TOTAL_STEPS > 1 ? ((clampedStep - 1) / (TOTAL_STEPS - 1)) * 100 : 100;
  const isCompleted = step > TOTAL_STEPS;

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setStepError("");
  }, [step]);

  const validateStepInput = (stepNumber: number): string | null => {
    if (stepNumber === 1) {
      if (normalizeWhitespace(formData.name).length < 2) {
        return "Please enter your full name.";
      }
      const age = Number(formData.age);
      if (!Number.isFinite(age) || age < 1 || age > 120) {
        return "Please enter a valid age between 1 and 120.";
      }
      if (!formData.sex) {
        return "Please select your sex.";
      }
      if (!formData.language) {
        return "Please select your preferred language.";
      }
      if (normalizeWhitespace(formData.city).length < 2) {
        return "Please enter your city.";
      }
      if (!formData.country) {
        return "Please select your country.";
      }
      return null;
    }

    if (stepNumber === 2) {
      return validateNarrativeText(formData.story, {
        minLength: 35,
        minTokens: 8,
        requireMedicalSignal: true,
      });
    }

    if (stepNumber === 3) {
      if (!formData.contactChannel) {
        return "Please choose a preferred contact method.";
      }
      const preparedContactInfo = composeContactInfo(
        formData.contactChannel,
        formData.contactInfo,
        formData.contactCountryCode,
      );
      const contactError = validateContactInfo(preparedContactInfo, formData.contactChannel);
      if (contactError) {
        return contactError;
      }
      if (!formData.consent) {
        return "Please confirm consent before submitting.";
      }
      return null;
    }

    return null;
  };

  const getFirstValidationIssue = (): { step: number; message: string } | null => {
    for (const stepNumber of [1, 2, 3]) {
      const message = validateStepInput(stepNumber);
      if (message) {
        return { step: stepNumber, message };
      }
    }
    return null;
  };

  const goNext = () => {
    const message = validateStepInput(step);
    if (message) {
      setStepError(message);
      return;
    }
    setStepError("");
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  const handleSubmit = async () => {
    setSubmitError("");
    const issue = getFirstValidationIssue();
    if (issue) {
      setStep(issue.step);
      setSubmitError(issue.message);
      return;
    }
    setIsSubmitting(true);

    const { contactCountryCode, ...formDataWithoutCountryCode } = formData;
    const preparedContactInfo = composeContactInfo(
      formData.contactChannel,
      formData.contactInfo,
      contactCountryCode,
    );
    const payload = {
      ...formDataWithoutCountryCode,
      name: normalizeWhitespace(formData.name),
      age: String(Math.round(Number(formData.age))),
      city: normalizeWhitespace(formData.city),
      contactInfo: preparedContactInfo,
      story: normalizeWhitespace(formData.story),
    };

    try {
      const result = await submitPatientIntake(payload);
      setPatientSession(
        String(result.patient_id),
        result.patient_code,
        payload.name || "Patient",
        result.patient_token,
      );
      if (selectedFiles.length > 0) {
        await Promise.all(
          selectedFiles.map((file) => uploadPatientDocument(result.patient_id, file, result.patient_token)),
        );
      }
      setStep(TOTAL_STEPS + 1);
    } catch {
      if (ENABLE_MOCK_FALLBACK) {
        setSubmitError(
          audienceCopy(
            "We could not submit right now. You can continue in demo mode.",
            "Could not submit to backend. Demo fallback mode is enabled, so you can continue.",
          ),
        );
        setStep(TOTAL_STEPS + 1);
      } else {
        setSubmitError(
          audienceCopy(
            "Could not submit your intake form. Please try again.",
            "Could not submit your intake form. Please check API availability and try again.",
          ),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {!isCompleted && (
        <div className="mb-8 text-center">
          <Badge
            variant="secondary"
            className="mb-4 gap-1.5 px-3 py-1.5 text-sm"
          >
            <Heart className="h-3.5 w-3.5 text-primary" />
            Patient Intake Form
          </Badge>
          <h1 className="text-2xl font-bold text-foreground">
            Tell Us About Your Condition
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Share your medical story in your own words. Our AI will help find
            clinical trials that may be relevant to you.
          </p>
        </div>
      )}

      {!isCompleted && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {clampedStep} of {TOTAL_STEPS}
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="mt-2 h-2" />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            {STEP_LABELS.map((label, index) => (
              <span
                key={label}
                className={clampedStep >= index + 1 ? "font-medium text-primary" : ""}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="e.g., 42"
                  value={formData.age}
                  onChange={(e) => updateField("age", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Sex</Label>
                <Select
                  value={formData.sex}
                  onValueChange={(v) => updateField("sex", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferred Language</Label>
                <Select
                  value={formData.language}
                  onValueChange={(v) => updateField("language", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="urdu">Urdu</SelectItem>
                    <SelectItem value="arabic">Arabic</SelectItem>
                    <SelectItem value="hindi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g., Karachi"
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(v) => updateField("country", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pakistan">Pakistan</SelectItem>
                    <SelectItem value="uae">UAE</SelectItem>
                    <SelectItem value="saudi">Saudi Arabia</SelectItem>
                    <SelectItem value="india">India</SelectItem>
                    <SelectItem value="oman">Oman</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Medical Story</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="story">
                Tell us about your medical condition in your own words
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Include your diagnosis, treatments you have tried, current
                symptoms, and any test results you remember. You can write in
                English, Urdu, or Arabic.
              </p>
              <Textarea
                id="story"
                placeholder="Example: I was diagnosed with breast cancer 2 years ago. I received chemotherapy and the tumor was removed by surgery. Recently, the cancer has come back and spread to my liver. My doctor says it is HER2-positive. I have tried trastuzumab but it stopped working..."
                rows={8}
                value={formData.story}
                onChange={(e) => updateField("story", e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-foreground">
                Upload Medical Documents (Optional)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload text-based documents such as PDF, TXT, or Markdown.
                Scanned images are not processed in this mode.
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.txt,.md,.markdown,.csv,.json,.yaml,.yml,.xml,.log,text/plain,text/markdown,application/pdf"
                className="hidden"
                id="patient-documents"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  setSelectedFiles(files);
                }}
              />
              <label
                htmlFor="patient-documents"
                className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Choose Files
              </label>
              {selectedFiles.length > 0 && (
                <div className="mt-3 text-left">
                  <p className="text-xs font-medium text-foreground">Selected files</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {selectedFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`}>- {file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {SHOW_TECHNICAL_COPY ? "AI-Powered Extraction" : "AI Review Support"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {SHOW_TECHNICAL_COPY
                      ? "Our AI will read your story and extract key medical details like diagnosis, stage, treatments, and biomarkers. You will be able to review and correct the extracted information."
                      : "Our AI will review your story and prepare a draft summary for the care team. You can review and correct your information before it is used."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact & Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Preferred Contact Method</Label>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "sms", label: "SMS" },
                  { value: "phone", label: "Phone Call" },
                  { value: "email", label: "Email" },
                ].map((ch) => (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => updateField("contactChannel", ch.value)}
                    className={`rounded-lg border p-3 text-center text-sm font-medium transition-all ${
                      formData.contactChannel === ch.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/30"
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              {formData.contactChannel === "email" ? (
                <>
                  <Label htmlFor="contactInfo">Email Address</Label>
                  <Input
                    id="contactInfo"
                    placeholder="your@email.com"
                    value={formData.contactInfo}
                    onChange={(e) => updateField("contactInfo", e.target.value)}
                    className="mt-1.5"
                  />
                </>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                    <div>
                      <Label>Country Code</Label>
                      <Select
                        value={formData.contactCountryCode}
                        onValueChange={(v) => updateField("contactCountryCode", v)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select code" />
                        </SelectTrigger>
                        <SelectContent>
                          {PHONE_COUNTRY_CODES.map((code) => (
                            <SelectItem key={code.value} value={code.value}>
                              {code.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="contactInfo">Phone Number</Label>
                      <Input
                        id="contactInfo"
                        placeholder="3001234567"
                        value={formData.contactInfo}
                        onChange={(e) => updateField("contactInfo", e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Enter your local number. We will add the selected country code automatically.
                  </p>
                </>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consent}
                  onChange={(e) => updateField("consent", e.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    I consent to share my medical information
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your information will be shared with hospital trial
                    coordinators solely for the purpose of identifying relevant
                    clinical trials. This is not a medical consultation.
                    Participation in any trial requires separate informed consent
                    with a physician.
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
              Review Your Submission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ReviewField label="Name" value={formData.name || "Not provided"} />
              <ReviewField label="Age" value={formData.age || "Not provided"} />
              <ReviewField label="Sex" value={formData.sex || "Not provided"} />
              <ReviewField
                label="Language"
                value={formData.language || "Not provided"}
              />
              <ReviewField
                label="Location"
                value={
                  formData.city && formData.country
                    ? `${formData.city}, ${formData.country}`
                    : "Not provided"
                }
              />
              <ReviewField
                label="Contact"
                value={
                  formData.contactChannel
                    ? `${formData.contactChannel.toUpperCase()}: ${composeContactInfo(
                        formData.contactChannel,
                        formData.contactInfo,
                        formData.contactCountryCode,
                      ) || "Not set"}`
                    : "Not provided"
                }
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Medical Story
              </p>
              <div className="mt-1 rounded-lg bg-muted/50 p-3">
                <p className="text-sm leading-relaxed text-foreground">
                  {formData.story || "No story provided"}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    What Happens Next
                  </p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    <li>
                      {SHOW_TECHNICAL_COPY
                        ? "1. Our AI extracts key medical details from your story"
                        : "1. Our AI reviews your story to understand your condition"}
                    </li>
                    <li>
                      2. We search clinical trial registries for relevant matches
                    </li>
                    <li>
                      3. A hospital coordinator reviews the matches
                    </li>
                    <li>
                      4. You will be contacted via {formData.contactChannel || "your chosen method"}{" "}
                      with results
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isCompleted && (
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <Button
              onClick={goNext}
              className="gap-1.5"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              className="gap-1.5"
              disabled={isSubmitting}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          )}
        </div>
      )}
      {stepError && (
        <p className="mt-3 text-xs text-[hsl(var(--warning))]">{stepError}</p>
      )}
      {submitError && (
        <p className="mt-3 text-xs text-[hsl(var(--warning))]">{submitError}</p>
      )}

      {step > TOTAL_STEPS && (
        <div className="mt-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success)/0.1)]">
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">
            Submission Received
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you, {formData.name || "patient"}. Our AI is now analyzing your
            information and searching for relevant clinical trials. A
            coordinator will review the results and contact you via{" "}
            {formData.contactChannel || "your chosen channel"}.
          </p>
          <Button
            variant="outline"
            className="mt-6 bg-transparent"
            onClick={() => (window.location.href = "/patient/portal")}
          >
            View My Portal
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
