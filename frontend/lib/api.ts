import type { MatchEvaluation, Patient, Trial } from "@/lib/mock-data";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000/api/v1";
export const ENABLE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === "1";

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type JsonObject = Record<string, unknown>;

export interface OutreachMessageItem {
  id: number;
  match: number;
  patient_name: string;
  trial_id: string;
  channel: string;
  direction?: string;
  body: string;
  status: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  replied_at?: string | null;
  created_at: string;
}

export interface PatientDocumentItem {
  id: number;
  patient: number;
  original_name: string;
  content_type: string;
  size_bytes: number;
  file_url: string;
  extraction_status: "pending" | "extracted" | "unsupported" | "empty" | "failed";
  extraction_error: string;
  extracted_text: string;
  extracted_text_preview: string;
  extracted_text_chars: number;
  created_at: string;
}

export interface PatientHistoryEntryItem {
  id: number;
  patient: number;
  source: "intake" | "patient_portal" | "coordinator";
  entry_text: string;
  created_at: string;
}

export interface CoordinatorPatientDetail {
  patient: Patient;
  documents: PatientDocumentItem[];
  historyEntries: PatientHistoryEntryItem[];
  matches: MatchEvaluation[];
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface FetchOptions {
  allowUnauthorized?: boolean;
  skipJsonContentType?: boolean;
}

function buildHeaders(init?: RequestInit, skipJsonContentType?: boolean): Headers {
  const headers = new Headers(init?.headers || {});
  if (!skipJsonContentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const accessToken = getAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return headers;
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return await response.text();
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError("No refresh token available", 401, null);
  }

  const response = await fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    clearAuthTokens();
    const body = await parseErrorBody(response);
    throw new ApiError("Token refresh failed", response.status, body);
  }

  const payload = (await response.json()) as { access: string };
  const currentRefresh = getRefreshToken();
  setAuthTokens(payload.access, currentRefresh);
  return payload.access;
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  options?: FetchOptions,
): Promise<T> {
  const run = async (authRetry: boolean): Promise<Response> => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: buildHeaders(init, options?.skipJsonContentType),
      cache: "no-store",
    });

    if (
      response.status === 401 &&
      !options?.allowUnauthorized &&
      !authRetry &&
      getRefreshToken()
    ) {
      await refreshAccessToken();
      return run(true);
    }
    return response;
  };

  const response = await run(false);

  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw new ApiError(`API ${path} failed`, response.status, body);
  }

  return (await response.json()) as T;
}

function mapPatient(raw: JsonObject): Patient {
  return {
    id: String(raw.id ?? raw.patient_code ?? ""),
    name: String(raw.full_name ?? ""),
    age: Number(raw.age ?? 0),
    sex: String(raw.sex ?? ""),
    city: String(raw.city ?? ""),
    country: String(raw.country ?? ""),
    language: String(raw.language ?? "English"),
    diagnosis: String(raw.diagnosis ?? ""),
    stage: String(raw.stage ?? ""),
    story: String(raw.story ?? ""),
    contactChannel: (String(raw.contactChannel ?? raw.contact_channel ?? "sms") as Patient["contactChannel"]),
    contactInfo: String(raw.contactInfo ?? raw.contact_value ?? ""),
    registeredAt: String(raw.registered_at ?? ""),
    profileCompleteness: Number(raw.profile_completeness ?? 0),
  };
}

function mapTrial(raw: JsonObject): Trial {
  return {
    id: String(raw.trial_id ?? ""),
    title: String(raw.title ?? ""),
    phase: String(raw.phase ?? ""),
    status: String(raw.status ?? "RECRUITING") as Trial["status"],
    conditions: (raw.conditions as string[]) ?? [],
    interventions: (raw.interventions as string[]) ?? [],
    locations:
      ((raw.locations as JsonObject[]) ?? []).map((site) => ({
        facility: String(site.facility ?? ""),
        city: String(site.city ?? ""),
        country: String(site.country ?? ""),
      })) ?? [],
    sponsor: String(raw.sponsor ?? ""),
    summary: String(raw.summary ?? ""),
    eligibilitySummary: String(raw.eligibility_summary ?? ""),
    source: (String(raw.source ?? "clinicaltrials.gov") as Trial["source"]),
    lastUpdated: String(raw.external_last_updated ?? ""),
  };
}

function mapMatch(raw: JsonObject): MatchEvaluation {
  const patient = mapPatient(raw.patient as JsonObject);
  const trial = mapTrial(raw.trial as JsonObject);

  return {
    id: String(raw.id ?? ""),
    patientId: patient.id,
    trialId: trial.id,
    patient,
    trial,
    eligibilityScore: Number(raw.eligibility_score ?? 0),
    feasibilityScore: Number(raw.feasibility_score ?? 0),
    urgencyScore: Number(raw.urgency_score ?? 0),
    explainabilityScore: Number(raw.explainability_score ?? 0),
    urgencyFlag: (String(raw.urgency_flag ?? "low") as MatchEvaluation["urgencyFlag"]),
    overallStatus: (String(raw.overall_status ?? "Possibly Eligible") as MatchEvaluation["overallStatus"]),
    reasonsMatched: (raw.reasons_matched as string[]) ?? [],
    reasonsFailed: (raw.reasons_failed as string[]) ?? [],
    missingInfo: (raw.missing_info as string[]) ?? [],
    doctorChecklist: (raw.doctor_checklist as string[]) ?? [],
    explanationSummary: String(raw.explanation_summary ?? ""),
    explanationLanguage: String(raw.explanation_language ?? "en"),
    explanationModel: String(raw.explanation_model ?? ""),
    promptVersion: String(raw.prompt_version ?? ""),
    confidence: Number(raw.confidence ?? 0),
    outreachStatus: (String(raw.outreach_status ?? "pending") as MatchEvaluation["outreachStatus"]),
    lastEvaluated: String(raw.last_evaluated ?? ""),
    isNew: Boolean(raw.is_new),
  };
}

export async function loginCoordinator(username: string, password: string) {
  const tokens = await fetchJson<{ access: string; refresh: string }>(
    "/auth/login/",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    { allowUnauthorized: true },
  );
  setAuthTokens(tokens.access, tokens.refresh);
  return tokens;
}

export function logoutCoordinator(): void {
  clearAuthTokens();
}

export async function getCurrentUser() {
  return fetchJson<{
    id: number;
    username: string;
    email: string;
    role: string;
    organization: string | null;
  }>("/auth/me/");
}

export async function getDashboardStats() {
  return fetchJson<{
    newMatches: number;
    highUrgency: number;
    awaitingInfo: number;
    outreachPending: number;
    totalPatients: number;
    totalTrials: number;
    avgEligibility: number;
  }>("/coordinator/dashboard/");
}

export async function getMatches(): Promise<MatchEvaluation[]> {
  const data = await fetchJson<Paginated<JsonObject>>("/coordinator/matches/");
  return data.results.map(mapMatch);
}

export async function getMatchDetail(id: string): Promise<MatchEvaluation> {
  const data = await fetchJson<JsonObject>(`/coordinator/matches/${id}/`);
  return mapMatch(data);
}

export async function getPatients(): Promise<Patient[]> {
  const data = await fetchJson<Paginated<JsonObject>>("/coordinator/patients/");
  return data.results.map(mapPatient);
}

export async function getCoordinatorPatientDetail(patientId: string): Promise<CoordinatorPatientDetail> {
  const data = await fetchJson<{
    patient: JsonObject;
    documents: PatientDocumentItem[];
    history_entries: PatientHistoryEntryItem[];
    matches: JsonObject[];
  }>(`/coordinator/patients/${patientId}/`);
  return {
    patient: mapPatient(data.patient),
    documents: data.documents || [],
    historyEntries: data.history_entries || [],
    matches: (data.matches || []).map(mapMatch),
  };
}

export async function getTrials(): Promise<Trial[]> {
  const data = await fetchJson<Paginated<JsonObject>>("/coordinator/trials/");
  return data.results.map(mapTrial);
}

export async function getOutreachMessages() {
  const data = await fetchJson<Paginated<OutreachMessageItem>>("/coordinator/outreach/");
  return data.results;
}

export async function sendOutreach(matchId: string, channel: string, body: string) {
  return fetchJson<JsonObject>("/coordinator/outreach/send/", {
    method: "POST",
    body: JSON.stringify({ match_id: Number(matchId), channel, body }),
  });
}

export async function getCoordinatorSettings() {
  return fetchJson<JsonObject>("/coordinator/settings/");
}

export async function updateCoordinatorSettings(scoreWeights: Record<string, number>) {
  return fetchJson<JsonObject>("/coordinator/settings/", {
    method: "PATCH",
    body: JSON.stringify({ score_weights: scoreWeights }),
  });
}

export async function runMatchingNow() {
  return fetchJson<JsonObject>("/coordinator/matching/run/", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function submitPatientIntake(payload: {
  name: string;
  age: string;
  sex: string;
  city: string;
  country: string;
  language: string;
  contactChannel: string;
  contactInfo: string;
  story: string;
  consent: boolean;
}) {
  return fetchJson<{ patient_id: number; patient_code: string; name?: string }>("/patient/intake/", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      age: Number(payload.age || 0),
    }),
  });
}

export async function patientAccess(patientCode: string, contactInfo: string) {
  return fetchJson<{
    patient_id: number;
    patient_code: string;
    name: string;
    contact_channel: string;
  }>(
    "/patient/access/",
    {
      method: "POST",
      body: JSON.stringify({
        patient_code: patientCode,
        contact_info: contactInfo,
      }),
    },
    { allowUnauthorized: true },
  );
}

export async function uploadPatientDocument(patientId: number, document: File) {
  const formData = new FormData();
  formData.append("document", document);

  return fetchJson<JsonObject>(
    `/patient/${patientId}/documents/`,
    {
      method: "POST",
      body: formData,
    },
    { skipJsonContentType: true, allowUnauthorized: true },
  );
}

export async function getPatientPortalMatches(patientId: string): Promise<MatchEvaluation[]> {
  const data = await fetchJson<Paginated<JsonObject>>(`/patient/${patientId}/matches/`, undefined, {
    allowUnauthorized: true,
  });
  return data.results.map(mapMatch);
}

export async function getPatientHistoryEntries(patientId: string): Promise<PatientHistoryEntryItem[]> {
  return fetchJson<PatientHistoryEntryItem[]>(`/patient/${patientId}/history/`, undefined, {
    allowUnauthorized: true,
  });
}

export async function addPatientHistoryEntry(patientId: string, entryText: string) {
  return fetchJson<{ entry: PatientHistoryEntryItem; matches_updated: number }>(
    `/patient/${patientId}/history/`,
    {
      method: "POST",
      body: JSON.stringify({ entry_text: entryText }),
    },
    { allowUnauthorized: true },
  );
}

export async function requestPatientContact(
  patientId: string,
  matchId: string,
  channel: "sms" | "whatsapp" | "email" | "phone",
  body: string,
) {
  return fetchJson<JsonObject>(
    `/patient/${patientId}/contact-request/`,
    {
      method: "POST",
      body: JSON.stringify({
        match_id: Number(matchId),
        channel,
        body,
      }),
    },
    { allowUnauthorized: true },
  );
}
