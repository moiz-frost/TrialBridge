export interface PatientSession {
  id: string;
  code: string;
  name: string;
  token: string;
}

const KEY_ID = "trialbridge_patient_id";
const KEY_CODE = "trialbridge_patient_code";
const KEY_NAME = "trialbridge_patient_name";
const KEY_TOKEN = "trialbridge_patient_token";

export function setPatientSession(id: string, code: string, name: string, token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_ID, id);
  window.localStorage.setItem(KEY_CODE, code);
  window.localStorage.setItem(KEY_NAME, name);
  window.localStorage.setItem(KEY_TOKEN, token);
}

export function getPatientSession(): PatientSession | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(KEY_ID);
  const code = window.localStorage.getItem(KEY_CODE);
  const name = window.localStorage.getItem(KEY_NAME);
  const token = window.localStorage.getItem(KEY_TOKEN);
  if (!id || !code || !token) return null;
  return {
    id,
    code,
    name: name || "Patient",
    token,
  };
}

export function clearPatientSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_ID);
  window.localStorage.removeItem(KEY_CODE);
  window.localStorage.removeItem(KEY_NAME);
  window.localStorage.removeItem(KEY_TOKEN);
}
