import { TitleCard } from "./TitleCard";
import type { Category } from "@/lib/tmdb";
import { useI18n } from "@/lib/i18n";

export function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-border/70 bg-card p-3">
      <div className="h-[132px] w-[88px] shrink-0 animate-pulse rounded-xl bg-secondary" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-20 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
        <div className="h-6 w-full animate-pulse rounded-full bg-secondary" />
      </div>
    </div>
  );
}

export function CategoryBlock({ category }: { category: Category }) {
  const { t } = useI18n();
  const copy = t.categories[category.id as keyof typeof t.categories];
  const title = copy?.[0] ?? category.id;
  const note = copy?.[1] ?? "";
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[17.33px] font-semibold text-foreground">
          {title}{" "}<span className="text-[13.33px] font-normal text-muted-foreground">({t.latestCount(category.items.length)})</span>
        </h2>
        <p className="mt-1 text-[12.33px] leading-relaxed text-muted-foreground">{note}</p>
      </div>
      {category.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 px-4 py-6 text-center text-[13.33px] text-muted-foreground">{t.categoryEmpty}</div>
      ) : (
        <div className="space-y-3">{category.items.map((item) => <TitleCard key={`${category.id}-${item.key}`} item={item} />)}</div>
      )}
    </section>
  );
}
