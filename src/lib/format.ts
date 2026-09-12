import type { Language } from "./i18n";

const localeMap: Record<Language, string> = { ms: "ms-MY", en: "en-MY", ar: "ar-MY" };

export function formatDate(value: string | null | undefined, language: Language): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeMap[language], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    numberingSystem: "latn",
  }).format(d);
}

export function formatTimestamp(ms: number | null | undefined, language: Language): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat(localeMap[language], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
  }).format(new Date(ms));
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function isoMonthsAgo(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}
