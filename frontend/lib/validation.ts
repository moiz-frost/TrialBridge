const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PATIENT_CODE_PATTERN = /^[A-Z]{2,5}-\d{3,8}$/;
const REPEATED_CHAR_PATTERN = /(.)\1{5,}/;
const WORD_PATTERN = /[\p{L}\p{N}\+\-]+/gu;

const MEDICAL_HINT_PATTERN =
  /\b(cancer|tumou?r|metasta\w+|stage|ecog|her2|brca|chemo\w*|radiation|biopsy|diagnos\w+|treatment|surgery|hormone|receptor|trial|oncolog\w+|carcinoma|lymphoma|leukemia|platelet|bilirubin|creatinine|cbc|lft|lab|blood|symptom|pain|mri|ct|scan)\b/i;

export interface NarrativeValidationOptions {
  minLength?: number;
  minTokens?: number;
  requireMedicalSignal?: boolean;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizePatientCode(value: string): string {
  return normalizeWhitespace(value).toUpperCase();
}

export function isLikelyEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeWhitespace(value));
}

export function normalizePhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  return digits;
}

export function isLikelyPhone(value: string): boolean {
  const digits = normalizePhoneDigits(value);
  return digits.length >= 8 && digits.length <= 15;
}

export function validatePatientCode(value: string): string | null {
  const normalized = normalizePatientCode(value);
  if (!normalized) {
    return "Please enter your patient code.";
  }
  if (!PATIENT_CODE_PATTERN.test(normalized)) {
    return "Use a valid patient code format, for example PAT-0006.";
  }
  return null;
}

export function validateContactInfo(value: string, channel?: string): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "Please enter contact information.";
  }
  if ((channel || "").toLowerCase() === "email") {
    if (!isLikelyEmail(normalized)) {
      return "Please enter a valid email address.";
    }
    return null;
  }

  if (normalized.includes("@")) {
    if (!isLikelyEmail(normalized)) {
      return "Please enter a valid email address.";
    }
    return null;
  }

  if (!isLikelyPhone(normalized)) {
    return "Please enter a valid phone number with country code if available.";
  }
  return null;
}

export function validateNarrativeText(
  value: string,
  options: NarrativeValidationOptions = {},
): string | null {
  const minLength = options.minLength ?? 35;
  const minTokens = options.minTokens ?? 8;
  const requireMedicalSignal = options.requireMedicalSignal ?? true;

  const text = normalizeWhitespace(value);
  if (!text) {
    return "Please provide your medical details.";
  }
  if (text.length < minLength) {
    return `Please add more detail (at least ${minLength} characters).`;
  }

  if (REPEATED_CHAR_PATTERN.test(text.toLowerCase())) {
    return "Your text looks repetitive. Please provide clear medical details.";
  }

  const tokens = text.match(WORD_PATTERN) || [];
  if (tokens.length < minTokens) {
    return `Please add a bit more detail (at least ${minTokens} words).`;
  }

  const uniqueRatio = new Set(tokens.map((token) => token.toLowerCase())).size / Math.max(tokens.length, 1);
  if (tokens.length >= 8 && uniqueRatio < 0.4) {
    return "Your text looks repetitive. Please describe your condition in plain language.";
  }

  const nonSpaceChars = text.replace(/\s+/g, "");
  const letterChars = (text.match(/[\p{L}]/gu) || []).length;
  if (nonSpaceChars.length >= 16) {
    const letterRatio = letterChars / nonSpaceChars.length;
    if (letterRatio < 0.45) {
      return "Please enter meaningful text instead of random characters.";
    }
  }

  if (requireMedicalSignal && !MEDICAL_HINT_PATTERN.test(text)) {
    return "Please include medical details like diagnosis, treatment, symptoms, or test results.";
  }

  return null;
}
