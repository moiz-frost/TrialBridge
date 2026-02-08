function asDate(value?: string | null): Date | null {
  if (!value) return null;
  let date = new Date(value);
  if (Number.isNaN(date.getTime()) && typeof value === "string") {
    const normalized = value.replace(
      /(\.\d{3})\d+(Z|[+-]\d{2}:\d{2})$/,
      "$1$2",
    );
    date = new Date(normalized);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatFriendlyDateTime(value?: string | null, fallback = "Pending"): string {
  const date = asDate(value);
  if (!date) return value || fallback;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatFriendlyDate(value?: string | null, fallback = "Pending"): string {
  const date = asDate(value);
  if (!date) return value || fallback;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatRelativeUpdate(value?: string | null, fallback = "Recently"): string {
  const date = asDate(value);
  if (!date) return value || fallback;

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 30) return "just now";

  const rtf = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
    style: "long",
  });

  if (absSeconds < 3600) {
    return rtf.format(Math.round(diffSeconds / 60), "minute");
  }

  if (absSeconds < 86_400) {
    return rtf.format(Math.round(diffSeconds / 3600), "hour");
  }

  if (absSeconds < 2_592_000) {
    return rtf.format(Math.round(diffSeconds / 86_400), "day");
  }

  return formatFriendlyDateTime(value, fallback);
}
