"use client";

import { ModuleBanner } from "@/components/ModuleBanner";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const LEVEL_ORDER = ["pre_primary", "primary", "junior_school", "senior_school", "other"] as const;
export const LEVEL_LABEL: Record<string, string> = {
  pre_primary: "Pre-Primary",
  primary: "Primary School",
  junior_school: "Junior School",
  senior_school: "Senior School",
  other: "Other classes",
};
export const LEVEL_BAR: Record<string, string> = {
  pre_primary: "bg-rose-500",
  primary: "bg-sky-500",
  junior_school: "bg-emerald-500",
  senior_school: "bg-violet-500",
  other: "bg-amber-500",
};

const TONES = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

export function Initials({ name, seed = 0, size = "md" }: { name: string; seed?: number; size?: "sm" | "md" | "lg" }) {
  const parts = name.trim().split(/\s+/);
  const text = `${parts[0]?.charAt(0) ?? ""}${parts.length > 1 ? parts[parts.length - 1].charAt(0) : ""}`.toUpperCase();
  const dim = size === "lg" ? "size-14 text-lg" : size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${dim} ${TONES[Math.abs(seed) % TONES.length]}`} aria-hidden>
      {text}
    </span>
  );
}

/** A thin progress line, with an optional tick showing where it should be by now. */
export function Meter({ value, total, expected, label }: { value: number; total: number; expected?: number | null; label: string }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  const tick = expected != null && total ? Math.min(100, (expected / total) * 100) : null;
  const behind = expected != null && value < expected;
  return (
    <div
      className="relative h-1.5 rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div className={`h-full rounded-full ${behind ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      {tick !== null && <span className="absolute -top-1 h-3.5 w-0.5 bg-foreground/50" style={{ left: `${tick}%` }} aria-hidden title="Where it should be by now" />}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "muted" | "brand" | "info"; children: React.ReactNode }) {
  const map = {
    good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    bad: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    muted: "bg-muted text-muted-foreground",
    brand: "bg-primary/10 text-primary",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${map[tone]}`}>{children}</span>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
      <AlertTriangle className="size-6 text-red-600" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}><RotateCw /> Try again</Button>
    </div>
  );
}

export function PageHead({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return <ModuleBanner title={title} description={subtitle}>{children}</ModuleBanner>;
}

export function ViewOnly({ children, label = "View only" }: { children?: React.ReactNode; label?: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-foreground uppercase">{label}</span>
      <span>{children ?? "You are seeing this as school leadership. Teachers keep this record."}</span>
    </p>
  );
}
