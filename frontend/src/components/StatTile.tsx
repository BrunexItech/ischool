import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type StatTone = "rose" | "sky" | "emerald" | "amber" | "violet";

const TONES: Record<StatTone, string> = {
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

/** A summary figure with a coloured icon. Pass `onClick` for a filter-style
 * tile, `href` for a link, or neither for a plain figure. */
export function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  onClick,
  href,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: StatTone;
  label: string;
  value: number | string;
  sub: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const interactive = Boolean(onClick || href);
  const body = (
    <div
      className={`flex h-full flex-col gap-1.5 rounded-xl border bg-card p-3 text-left sm:flex-row sm:items-center sm:gap-4 sm:p-4 ${
        interactive ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""
      } ${active ? "border-primary ring-1 ring-primary" : ""}`}
    >
      <div className="flex items-center gap-2 sm:contents">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full sm:size-12 ${TONES[tone]}`}>
          <Icon className="size-4 sm:size-6" />
        </span>
        <p className="text-sm leading-tight text-muted-foreground sm:hidden">{label}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="hidden text-sm text-muted-foreground sm:block">{label}</p>
        <p className="font-heading text-2xl leading-tight font-semibold tabular-nums">{value}</p>
        <p className="text-xs leading-tight text-muted-foreground">{sub}</p>
      </div>
      {interactive && <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />}
    </div>
  );

  const focus = "block h-full w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring";
  if (href) {
    return (
      <Link href={href} className={focus}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={focus}>
        {body}
      </button>
    );
  }
  return body;
}
