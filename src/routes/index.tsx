import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Film, Languages } from "lucide-react";
import { CardSkeleton, CategoryBlock } from "@/components/CategoryBlock";
import { Button } from "@/components/ui/button";
import { APP_METADATA } from "@/lib/app-metadata";
import { languageOptions, useI18n, type Language } from "@/lib/i18n";
import { loadSnapshot, saveSnapshot } from "@/lib/settings";
import { fetchSnapshot, type Category, type Snapshot, type Title } from "@/lib/tmdb";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Latest Movies & Series" },
    { name: "description", content: "Discover the newest movies and series available in Malaysia." },
    { property: "og:title", content: "Latest Movies & Series" },
    { property: "og:description", content: "The newest movies and series for Malaysian viewers." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Home,
});

type Section = "all" | "cinema" | "netflix";
type CinemaFilter = "all" | "movies" | "series" | "upcoming";
type NetflixFilter = "all" | "movies" | "series" | "popular";
type SortMode = "date" | "rating";
type HeaderMenu = "language" | "sort" | "cinema" | "netflix" | null;

const SORT_KEY = "lmd_my_sort";

function readSortMode(): SortMode {
  if (typeof window === "undefined") return "date";
  return window.localStorage.getItem(SORT_KEY) === "rating" ? "rating" : "date";
}

function dedupe(items: Title[]): Title[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function sortItems(items: Title[], mode: SortMode, upcoming = false): Title[] {
  const copy = dedupe(items);
  if (mode === "rating") {
    return copy.sort((a, b) => {
      const ar = a.tmdb && a.tmdb > 0 ? a.tmdb : -1;
      const br = b.tmdb && b.tmdb > 0 ? b.tmdb : -1;
      return br - ar;
    });
  }

  const validTime = (value: string | null) => {
    if (!value) return null;
    const time = new Date(`${value}T00:00:00`).getTime();
    return Number.isNaN(time) ? null : time;
  };

  return copy.sort((a, b) => {
    const at = validTime(a.date);
    const bt = validTime(b.date);
    if (at === null && bt === null) return 0;
    if (at === null) return 1;
    if (bt === null) return -1;
    return upcoming ? at - bt : bt - at;
  });
}

function categoryItems(snapshot: Snapshot | null, ids: string[]): Title[] {
  if (!snapshot) return [];
  return snapshot.categories
    .filter((category) => ids.includes(category.id))
    .flatMap((category) => category.items);
}

function makeCategory(id: string, items: Title[], mode: SortMode, upcoming = false): Category {
  return {
    id,
    group: id.startsWith("netflix") ? "netflix" : "cinema",
    items: sortItems(items, mode, upcoming).slice(0, 10),
  };
}

function Home() {
  const { t, language, setLanguage } = useI18n();
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const [section, setSection] = useState<Section>("all");
  const [cinemaFilter, setCinemaFilter] = useState<CinemaFilter>("all");
  const [netflixFilter, setNetflixFilter] = useState<NetflixFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    setSortMode(readSortMode());
  }, []);

  const changeSort = (next: SortMode) => {
    setSortMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem(SORT_KEY, next);
    setOpenMenu(null);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      const next = await fetchSnapshot(language, t.untitled);
      setSnapshot(next);
      saveSnapshot(next);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }, [language, t.untitled]);

  useEffect(() => {
    const cached = loadSnapshot<Snapshot>();
    if (cached?.data.language === language) setSnapshot(cached.data);
    else setSnapshot(null);

    void refresh();
  }, [refresh]);

  const errorText = (() => {
    if (!errorCode) return null;
    if (errorCode.startsWith("TMDB_INVALID:")) return `${t.tokenInvalid(Number(errorCode.split(":")[1]))} ${t.showingCache}`;
    if (errorCode.startsWith("TMDB_ERROR:")) return `${t.tmdbError(Number(errorCode.split(":")[1]))} ${t.showingCache}`;
    return `${t.loadFailed} ${t.showingCache}`;
  })();

  const displayCategory = useMemo(() => {
    if (!snapshot) return null;

    if (section === "all") {
      return makeCategory(
        "all-latest",
        categoryItems(snapshot, ["cinema-now", "streaming-movies", "streaming-tv", "nf-movies", "nf-tv"]),
        sortMode,
      );
    }

    if (section === "cinema") {
      if (cinemaFilter === "movies") {
        return makeCategory("cinema-movies", categoryItems(snapshot, ["cinema-now", "streaming-movies"]), sortMode);
      }
      if (cinemaFilter === "series") {
        return makeCategory("cinema-series", categoryItems(snapshot, ["streaming-tv"]), sortMode);
      }
      if (cinemaFilter === "upcoming") {
        return makeCategory("upcoming", categoryItems(snapshot, ["upcoming"]), sortMode, sortMode === "date");
      }
      return makeCategory(
        "cinema-all",
        categoryItems(snapshot, ["cinema-now", "streaming-movies", "streaming-tv"]),
        sortMode,
      );
    }

    if (netflixFilter === "movies") {
      return makeCategory("nf-movies", categoryItems(snapshot, ["nf-movies"]), sortMode);
    }
    if (netflixFilter === "series") {
      return makeCategory("nf-tv", categoryItems(snapshot, ["nf-tv"]), sortMode);
    }
    if (netflixFilter === "popular") {
      return makeCategory("nf-popular", categoryItems(snapshot, ["nf-popular"]), sortMode);
    }
    return makeCategory(
      "netflix-all",
      categoryItems(snapshot, ["nf-movies", "nf-tv"]),
      sortMode,
    );
  }, [snapshot, section, cinemaFilter, netflixFilter, sortMode]);

  const showSkeleton = loading && !snapshot;

  const toggleMenu = (menu: Exclude<HeaderMenu, null>) => {
    setOpenMenu((current) => current === menu ? null : menu);
  };

  const openCinemaMenu = () => {
    setSection("cinema");
    toggleMenu("cinema");
  };

  const openNetflixMenu = () => {
    setSection("netflix");
    toggleMenu("netflix");
  };

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto max-w-xl px-4 py-3 text-center">
          <h1 className="text-[18px] font-bold tracking-tight text-foreground">Latest Movies &amp; Series</h1>

          <p className="mt-0.5 whitespace-nowrap text-[9.5px] leading-tight text-muted-foreground">
            Made with love by Masterzoul | {APP_METADATA.version.toUpperCase()} ({APP_METADATA.compactDisplay})
          </p>

          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => toggleMenu("language")}
              aria-label={t.language}
              title={t.language}
              className={`flex size-9 items-center justify-center rounded-full border transition-colors ${openMenu === "language" ? "border-primary bg-secondary text-primary" : "border-border bg-card/70 text-foreground"}`}
            >
              <Languages className="size-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => toggleMenu("sort")}
              aria-label={t.sortBy}
              title={t.sortBy}
              className={`flex size-9 items-center justify-center rounded-full border transition-colors ${openMenu === "sort" ? "border-primary bg-secondary text-primary" : "border-border bg-card/70 text-foreground"}`}
            >
              <ArrowUpDown className="size-[18px]" />
            </button>

            <button
              type="button"
              onClick={openCinemaMenu}
              aria-label={t.cinemaTab}
              title={t.cinemaTab}
              className={`flex size-9 items-center justify-center rounded-full border transition-colors ${section === "cinema" ? "border-primary bg-secondary text-primary" : "border-border bg-card/70 text-foreground"}`}
            >
              <Film className="size-[19px]" />
            </button>

            <button
              type="button"
              onClick={openNetflixMenu}
              aria-label={t.netflixTab}
              title={t.netflixTab}
              className={`flex size-9 items-center justify-center rounded-full border transition-colors ${section === "netflix" ? "border-primary bg-secondary" : "border-border bg-card/70"}`}
            >
              <span className="text-[20px] font-black leading-none text-red-600">N</span>
            </button>
          </div>

          {openMenu && (
            <div className="mt-2 w-full max-w-full overflow-hidden rounded-xl border border-border/70 bg-card/95 p-2 shadow-lg">
              {openMenu === "language" && (
                <div className="grid w-full grid-cols-3 gap-2">
                  {languageOptions.map((option) => (
                    <Button
                      key={option.value}
                      onClick={() => {
                        setLanguage(option.value as Language);
                        setOpenMenu(null);
                      }}
                      variant={language === option.value ? "secondary" : "outline"}
                      className="h-auto min-w-0 w-full whitespace-normal break-words rounded-full px-2.5 py-1.5 text-center text-[12.33px] leading-tight"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}

              {openMenu === "sort" && (
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button
                    onClick={() => changeSort("date")}
                    variant={sortMode === "date" ? "secondary" : "outline"}
                    className="h-auto min-w-0 w-full whitespace-normal break-words rounded-full px-2.5 py-1.5 text-center text-[12.33px] leading-tight"
                  >
                    {t.sortDate} — {t.sortDateHint}
                  </Button>
                  <Button
                    onClick={() => changeSort("rating")}
                    variant={sortMode === "rating" ? "secondary" : "outline"}
                    className="h-auto min-w-0 w-full whitespace-normal break-words rounded-full px-2.5 py-1.5 text-center text-[12.33px] leading-tight"
                  >
                    {t.sortRating} — {t.sortRatingHint}
                  </Button>
                </div>
              )}

              {openMenu === "cinema" && (
                <div className="grid w-full grid-cols-2 gap-2">
                  {([
                    ["all", t.allButton],
                    ["movies", t.moviesButton],
                    ["series", t.seriesButton],
                    ["upcoming", t.upcomingButton],
                  ] as [CinemaFilter, string][]).map(([value, label]) => (
                    <Button
                      key={value}
                      onClick={() => {
                        setSection("cinema");
                        setCinemaFilter(value);
                        setOpenMenu(null);
                      }}
                      variant={cinemaFilter === value ? "secondary" : "outline"}
                      className="h-auto min-w-0 w-full whitespace-normal break-words rounded-full px-2.5 py-1.5 text-center text-[12.33px] leading-tight"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}

              {openMenu === "netflix" && (
                <div className="grid w-full grid-cols-2 gap-2">
                  {([
                    ["all", t.allButton],
                    ["movies", t.moviesButton],
                    ["series", t.seriesButton],
                    ["popular", t.popularButton],
                  ] as [NetflixFilter, string][]).map(([value, label]) => (
                    <Button
                      key={value}
                      onClick={() => {
                        setSection("netflix");
                        setNetflixFilter(value);
                        setOpenMenu(null);
                      }}
                      variant={netflixFilter === value ? "secondary" : "outline"}
                      className="h-auto min-w-0 w-full whitespace-normal break-words rounded-full px-2.5 py-1.5 text-center text-[12.33px] leading-tight"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-8 px-4 py-5">
        {errorText && (
          <div className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-[13.33px] leading-relaxed text-foreground">
            {errorText}
          </div>
        )}

        {section === "netflix" && (
          <p className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-[12.33px] leading-relaxed text-muted-foreground">{t.netflixNotice}</p>
        )}

        {showSkeleton ? (
          <div className="space-y-4">{Array.from({ length: 5 }).map((_, index) => <CardSkeleton key={index} />)}</div>
        ) : displayCategory ? (
          <CategoryBlock category={displayCategory} />
        ) : !errorText && (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 px-4 py-8 text-center text-[13.33px] text-muted-foreground">
            {t.enterTokenStart}
          </div>
        )}

        <footer className="border-t border-border/70 pt-4 text-[11.33px] leading-relaxed text-muted-foreground">{t.source}</footer>
      </main>
    </div>
  );
}
