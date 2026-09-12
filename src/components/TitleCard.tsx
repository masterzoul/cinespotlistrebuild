import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Title } from "@/lib/tmdb";

function normalizeImdb(value: string | null | undefined) {
  if (!value || value === "N/A") return "-";
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : value;
}

function normalizeRt(value: string | null | undefined) {
  if (!value || value === "N/A") return "-";
  const percent = Number.parseFloat(value.replace("%", ""));
  if (!Number.isFinite(percent)) return value;
  const outOfFive = percent / 20;
  return `${Number.isInteger(outOfFive) ? outOfFive.toFixed(0) : outOfFive.toFixed(1)}/5`;
}

function normalizeMetacritic(value: string | null | undefined) {
  if (!value || value === "N/A") return "-";
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? (parsed / 10).toFixed(1) : value;
}

function normalizeTmdb(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "-";
}

function originalLanguageLabel(value: string | null | undefined) {
  if (!value) return "-";
  const code = value.toLowerCase();
  const map: Record<string, string> = {
    en: "ENG",
    ms: "MSA",
    ar: "ARA",
    ko: "KOR",
    ja: "JPN",
    zh: "ZHO",
    th: "THA",
    id: "IND",
    hi: "HIN",
    es: "SPA",
    fr: "FRA",
    de: "DEU",
    it: "ITA",
    pt: "POR",
    ru: "RUS",
    ta: "TAM",
    te: "TEL",
  };
  return map[code] ?? code.toUpperCase();
}

function combinedTitle(item: Title) {
  const original = item.originalName?.trim() || "";
  const localized = item.name.trim();
  const english = item.englishName?.trim() || "";

  const translated =
    localized && localized !== original
      ? localized
      : english && english !== original
        ? english
        : "";

  if (original && translated) return `${original} ${translated}`;
  return localized || original || english;
}

export function TitleCard({ item }: { item: Title }) {
  const [open, setOpen] = useState(false);
  const { t, language } = useI18n();
  const mediaLabel = item.media === "movie" ? t.movie : t.series;
  const displayTitle = combinedTitle(item);

  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_10px_30px_-18px_oklch(0_0_0/0.9)]">
      <div className="flex min-w-0 gap-3 p-3 pb-2">
        <div className="h-[132px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-secondary">
          {item.poster ? (
            <img src={item.poster} alt={t.posterAlt(displayTitle)} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11.33px] text-muted-foreground">{t.noPoster}</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[12.33px] font-medium text-accent">
            {formatDate(item.date, language)}
            <span className="mx-1 text-muted-foreground">|</span>
            <span className="font-semibold uppercase text-primary">{mediaLabel}</span>
            <span className="mx-1 text-muted-foreground">|</span>
            <span className="font-semibold uppercase text-muted-foreground">{originalLanguageLabel(item.originalLanguage)}</span>
          </p>

          <h3 className="mt-0.5 line-clamp-2 text-[16.33px] font-semibold leading-snug text-foreground">{displayTitle}</h3>

          <p className="mt-1 text-[11.33px] leading-snug text-muted-foreground">
            {item.genres.length > 0 ? item.genres.join(" • ") : "-"}
          </p>

          {item.provider && (
            <p className="mt-1 text-[11.33px] font-medium text-destructive">{item.provider}</p>
          )}
        </div>
      </div>

      <div className="w-full max-w-full overflow-hidden px-3 pb-2">
        <p className="w-full whitespace-nowrap text-center text-[clamp(7.5px,2.5vw,11.5px)] leading-tight tracking-[-0.025em] text-foreground">
          <span className="font-semibold text-muted-foreground">IMDb</span> {normalizeImdb(item.ratings?.imdb)}
          <span className="mx-[0.3em] text-muted-foreground">|</span>
          <span className="font-semibold text-muted-foreground">RT</span> {normalizeRt(item.ratings?.rt)}
          <span className="mx-[0.3em] text-muted-foreground">|</span>
          <span className="font-semibold text-muted-foreground">MC</span> {normalizeMetacritic(item.ratings?.metacritic)}
          <span className="mx-[0.3em] text-muted-foreground">|</span>
          <span className="font-semibold text-muted-foreground">TMDb</span> {normalizeTmdb(item.tmdb)}
        </p>
      </div>

      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-t border-border/60 px-4 py-2.5 text-[13.33px] font-medium text-muted-foreground transition-colors hover:bg-secondary/50"
        aria-expanded={open}
        aria-label={open ? t.collapseDetails : t.details}
      >
        {open ? t.collapseDetails : t.details}
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/60 bg-secondary/25 px-4 py-3 text-[13.33px] leading-relaxed text-muted-foreground">
          <p>{item.overview || t.synopsisMissing}</p>
          <p>{t.releaseDate}: <span className="text-foreground">{formatDate(item.date, language)}</span></p>
          {item.provider && <p>{t.platform}: <span className="text-foreground">{item.provider}</span> ({t.providerData})</p>}
        </div>
      )}
    </article>
  );
}
