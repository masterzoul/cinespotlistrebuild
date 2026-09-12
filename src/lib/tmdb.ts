import { createServerFn } from "@tanstack/react-start";
import type { Language } from "./i18n";
import { isoMonthsAgo, todayISO } from "./format";

export type ExternalRatings = {
  imdb?: string | null;
  rt?: string | null;
  metacritic?: string | null;
};

export type Title = {
  key: string;
  id: number;
  media: "movie" | "tv";
  name: string;
  originalName: string | null;
  englishName: string | null;
  poster: string | null;
  date: string | null;
  originalLanguage: string | null;
  genres: string[];
  overview: string;
  tmdb: number | null;
  popularity: number;
  provider?: string;
  imdbId?: string | null;
  ratings?: ExternalRatings;
};

export type Category = {
  id: string;
  group: "cinema" | "netflix";
  items: Title[];
};

export type Snapshot = {
  categories: Category[];
  fetchedAt: number;
  language: Language;
};

type Raw = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  genre_ids?: number[];
  overview?: string;
  vote_average?: number;
  popularity?: number;
};

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w342";
const LANG: Record<Language, string> = {
  ms: "ms-MY",
  en: "en-US",
  ar: "ar-SA",
};

function numRating(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function tmdbGet(token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(API + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (res.status === 401) throw new Error("TMDB_INVALID:401");
  if (!res.ok) throw new Error(`TMDB_ERROR:${res.status}`);
  return (await res.json()) as any;
}

async function genreMap(token: string, media: "movie" | "tv", language: Language) {
  const [localized, english] = await Promise.all([
    tmdbGet(token, `/genre/${media}/list`, { language: LANG[language] }).catch(() => ({ genres: [] })),
    language === "en"
      ? Promise.resolve({ genres: [] })
      : tmdbGet(token, `/genre/${media}/list`, { language: "en-US" }).catch(() => ({ genres: [] })),
  ]);

  const en = new Map<number, string>();
  for (const g of english.genres ?? []) if (g?.id && g?.name) en.set(g.id, g.name);

  const out = new Map<number, string>();
  for (const g of localized.genres ?? []) {
    if (!g?.id) continue;
    const name = String(g.name ?? "").trim() || en.get(g.id) || "";
    if (name) out.set(g.id, name);
  }
  for (const [id, name] of en) if (!out.has(id)) out.set(id, name);
  return out;
}

function rawName(raw: Raw) {
  return String(raw.title ?? raw.name ?? raw.original_title ?? raw.original_name ?? "").trim();
}

function rawOriginalName(raw: Raw) {
  return String(raw.original_title ?? raw.original_name ?? raw.title ?? raw.name ?? "").trim();
}

function rawDate(raw: Raw) {
  return String(raw.release_date ?? raw.first_air_date ?? "").trim() || null;
}

function toTitle(
  raw: Raw,
  media: "movie" | "tv",
  genres: Map<number, string>,
  untitled: string,
  provider?: string,
): Title {
  const name = rawName(raw) || untitled;
  const originalName = rawOriginalName(raw) || name;
  return {
    key: `${media}:${raw.id}`,
    id: raw.id,
    media,
    name,
    originalName,
    englishName: null,
    poster: raw.poster_path ? IMG + raw.poster_path : null,
    date: rawDate(raw),
    originalLanguage: raw.original_language ?? null,
    genres: (raw.genre_ids ?? []).map((id) => genres.get(id)).filter((v): v is string => Boolean(v)),
    overview: String(raw.overview ?? "").trim(),
    tmdb: numRating(raw.vote_average),
    popularity: typeof raw.popularity === "number" ? raw.popularity : 0,
    ...(provider ? { provider } : {}),
    ratings: {},
  };
}

function dedupe(items: Title[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function sortByDateDesc(items: Title[]) {
  return [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

function sortByDateAsc(items: Title[]) {
  return [...items].sort((a, b) => (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99"));
}

async function discover(
  token: string,
  media: "movie" | "tv",
  language: Language,
  params: Record<string, string>,
) {
  const result = await tmdbGet(token, `/discover/${media}`, {
    language: LANG[language],
    region: "MY",
    watch_region: "MY",
    page: "1",
    ...params,
  });
  return (result.results ?? []) as Raw[];
}

async function nowPlaying(token: string, language: Language) {
  const result = await tmdbGet(token, "/movie/now_playing", {
    language: LANG[language],
    region: "MY",
    page: "1",
  });
  return (result.results ?? []) as Raw[];
}

async function upcoming(token: string, language: Language) {
  const result = await tmdbGet(token, "/movie/upcoming", {
    language: LANG[language],
    region: "MY",
    page: "1",
  });
  return (result.results ?? []) as Raw[];
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

async function omdbRatings(apiKey: string, imdbId: string): Promise<ExternalRatings> {
  try {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("i", imdbId);
    url.searchParams.set("apikey", apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) return {};
    const data = (await res.json()) as any;
    if (data?.Response === "False") return {};
    const rt = Array.isArray(data?.Ratings)
      ? data.Ratings.find((r: any) => r?.Source === "Rotten Tomatoes")?.Value ?? null
      : null;
    return {
      imdb: data?.imdbRating && data.imdbRating !== "N/A" ? String(data.imdbRating) : null,
      rt: rt && rt !== "N/A" ? String(rt) : null,
      metacritic: data?.Metascore && data.Metascore !== "N/A" ? String(data.Metascore) : null,
    };
  } catch {
    return {};
  }
}

async function enrich(
  token: string,
  omdbKey: string,
  language: Language,
  categories: Category[],
) {
  const unique = dedupe(categories.flatMap((c) => c.items));
  await pool(unique, 5, async (item) => {
    try {
      const needsEnglish =
        language !== "en" &&
        ((item.name.trim() === (item.originalName ?? "").trim()) || !item.overview.trim());
      const detail = await tmdbGet(token, `/${item.media}/${item.id}`, {
        language: needsEnglish ? "en-US" : LANG[language],
        append_to_response: "external_ids",
      });

      const englishTitle = String(detail.title ?? detail.name ?? "").trim();
      if (needsEnglish && englishTitle && englishTitle !== item.originalName) item.englishName = englishTitle;
      if (!item.overview.trim()) item.overview = String(detail.overview ?? "").trim();

      const imdbId = String(detail.imdb_id ?? detail.external_ids?.imdb_id ?? "").trim() || null;
      item.imdbId = imdbId;
      if (imdbId && omdbKey) item.ratings = await omdbRatings(omdbKey, imdbId);
    } catch {
      // A failed detail/OMDb call must never block the TMDb catalog.
    }
  });

  const byKey = new Map(unique.map((item) => [item.key, item]));
  for (const category of categories) {
    category.items = category.items.map((item) => byKey.get(item.key) ?? item);
  }
}

const fetchSnapshotServer = createServerFn({ method: "POST" })
  .inputValidator((data: { language: Language; untitled: string }) => data)
  .handler(async ({ data }): Promise<Snapshot> => {
    const token = String(process.env["TMDB_READ_TOKEN"] ?? "").trim();
    const omdbKey = String(process.env["OMDB_API_KEY"] ?? "").trim();
    if (!token) throw new Error("NO_TMDB_SECRET");

    const [movieGenres, tvGenres] = await Promise.all([
      genreMap(token, "movie", data.language),
      genreMap(token, "tv", data.language),
    ]);

    const today = todayISO();
    const yearAgo = isoMonthsAgo(12);

    const [
      cinemaRaw,
      streamingMoviesRaw,
      streamingTvRaw,
      upcomingRaw,
      nfMoviesRaw,
      nfTvRaw,
      nfPopularMoviesRaw,
      nfPopularTvRaw,
    ] = await Promise.all([
      nowPlaying(token, data.language),
      discover(token, "movie", data.language, {
        sort_by: "primary_release_date.desc",
        with_watch_monetization_types: "flatrate",
        "primary_release_date.lte": today,
      }),
      discover(token, "tv", data.language, {
        sort_by: "first_air_date.desc",
        with_watch_monetization_types: "flatrate",
        "first_air_date.lte": today,
      }),
      upcoming(token, data.language),
      discover(token, "movie", data.language, {
        sort_by: "primary_release_date.desc",
        with_watch_providers: "8",
        with_watch_monetization_types: "flatrate",
        "primary_release_date.lte": today,
      }),
      discover(token, "tv", data.language, {
        sort_by: "first_air_date.desc",
        with_watch_providers: "8",
        with_watch_monetization_types: "flatrate",
        "first_air_date.lte": today,
      }),
      discover(token, "movie", data.language, {
        sort_by: "popularity.desc",
        with_watch_providers: "8",
        with_watch_monetization_types: "flatrate",
        "primary_release_date.gte": yearAgo,
        "primary_release_date.lte": today,
      }),
      discover(token, "tv", data.language, {
        sort_by: "popularity.desc",
        with_watch_providers: "8",
        with_watch_monetization_types: "flatrate",
        "first_air_date.gte": yearAgo,
        "first_air_date.lte": today,
      }),
    ]);

    const categories: Category[] = [
      {
        id: "cinema-now",
        group: "cinema",
        items: sortByDateDesc(cinemaRaw.map((r) => toTitle(r, "movie", movieGenres, data.untitled))).slice(0, 10),
      },
      {
        id: "streaming-movies",
        group: "cinema",
        items: sortByDateDesc(streamingMoviesRaw.map((r) => toTitle(r, "movie", movieGenres, data.untitled))).slice(0, 10),
      },
      {
        id: "streaming-tv",
        group: "cinema",
        items: sortByDateDesc(streamingTvRaw.map((r) => toTitle(r, "tv", tvGenres, data.untitled))).slice(0, 10),
      },
      {
        id: "upcoming",
        group: "cinema",
        items: sortByDateAsc(
          upcomingRaw
            .map((r) => toTitle(r, "movie", movieGenres, data.untitled))
            .filter((item) => !item.date || item.date >= today),
        ).slice(0, 10),
      },
      {
        id: "nf-movies",
        group: "netflix",
        items: sortByDateDesc(
          nfMoviesRaw.map((r) => toTitle(r, "movie", movieGenres, data.untitled, "Netflix")),
        ).slice(0, 10),
      },
      {
        id: "nf-tv",
        group: "netflix",
        items: sortByDateDesc(
          nfTvRaw.map((r) => toTitle(r, "tv", tvGenres, data.untitled, "Netflix")),
        ).slice(0, 10),
      },
      {
        id: "nf-popular",
        group: "netflix",
        items: dedupe([
          ...nfPopularMoviesRaw.map((r) => toTitle(r, "movie", movieGenres, data.untitled, "Netflix")),
          ...nfPopularTvRaw.map((r) => toTitle(r, "tv", tvGenres, data.untitled, "Netflix")),
        ])
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 10),
      },
    ];

    await enrich(token, omdbKey, data.language, categories);
    return { categories, fetchedAt: Date.now(), language: data.language };
  });

export async function fetchSnapshot(language: Language, untitled: string): Promise<Snapshot> {
  return await fetchSnapshotServer({ data: { language, untitled } });
}
