"use client";

import { ReactNode } from "react";
import { schoolColor } from "@/components/group/GroupUi";

export function initialsOf(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

/** A round monogram in a colour that stays the same for the same learner everywhere. */
export function ChildAvatar({ first, last, index = 0, size = 48 }: { first: string; last: string; index?: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-heading font-semibold text-white shadow-sm ring-2 ring-white/70"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${schoolColor(index)}, ${schoolColor(index + 3)})`, fontSize: size * 0.36 }}
    >
      {initialsOf(first, last)}
    </span>
  );
}

export const money = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

export function longDay(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function shortDay(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function daysFrom(todayIso: string, iso: string) {
  return Math.round((new Date(iso + "T12:00:00").getTime() - new Date(todayIso + "T12:00:00").getTime()) / 86_400_000);
}

export function dueWords(todayIso: string, iso: string) {
  const d = daysFrom(todayIso, iso);
  if (d < -1) return `${-d} days late`;
  if (d === -1) return "Was due yesterday";
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due ${shortDay(iso)}`;
}

/** A titled block that every family page uses, so spacing and headings stay the same throughout. */
export function Section({ title, hint, action, children, className = "" }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border bg-card p-4 shadow-xs sm:p-5 ${className}`}>{children}</div>;
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">{icon}</span>
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "info" | "quiet"; children: ReactNode }) {
  const t = {
    good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    warn: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    bad: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    quiet: "bg-muted text-muted-foreground",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${t}`}>{children}</span>;
}

/** The grade colour a learner would recognise: green for strong work, amber for fair, red for needs help. */
export function scoreTone(score: number): "good" | "warn" | "bad" {
  return score >= 70 ? "good" : score >= 50 ? "warn" : "bad";
}
