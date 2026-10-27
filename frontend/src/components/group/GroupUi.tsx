"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { GroupColumn } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader } from "@/components/Spinner";

export const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
export const compactKes = (n: number) => (n >= 1_000_000 ? `KES ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : n >= 1_000 ? `KES ${Math.round(n / 1_000)}K` : `KES ${Math.round(n)}`);

export function formatValue(v: number | null | undefined, kind: GroupColumn["kind"]): string {
  if (v === null || v === undefined) return "—";
  switch (kind) {
    case "percent":
      return `${v}%`;
    case "money":
      return kes(v);
    case "score":
    case "decimal":
      return String(v);
    default:
      return Math.round(v).toLocaleString();
  }
}

/** Each school keeps the same colour on every page, so it can be recognised at a glance. */
export const SCHOOL_COLORS = ["#8B1A1D", "#0E7490", "#B45309", "#4D7C0F", "#6D28D9", "#BE185D", "#1D4ED8", "#0F766E"];
export const schoolColor = (index: number) => SCHOOL_COLORS[index % SCHOOL_COLORS.length];

/** Colour for a percentage: green when healthy, amber when slipping, red when low. */
export function healthTone(p: number | null | undefined) {
  if (p === null || p === undefined) return { hex: "#94A3B8", bar: "bg-muted-foreground/30", text: "text-muted-foreground" };
  if (p >= 85) return { hex: "#059669", bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" };
  if (p >= 65) return { hex: "#D97706", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" };
  return { hex: "#DC2626", bar: "bg-red-500", text: "text-red-700 dark:text-red-400" };
}

export function Bar({ value, label }: { value: number | null | undefined; label: string }) {
  const t = healthTone(value);
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${value ?? "no figure"}${value != null ? "%" : ""}`}>
      <span className={`block h-full rounded-full transition-all duration-700 ${t.bar}`} style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
    </span>
  );
}

/** A circular gauge. `value` is 0 to 100; with no value the ring is empty and says so. */
export function Ring({ value, size = 88, stroke = 9, color, track = "currentColor", label, children, trackOpacity = 0.12 }: { value: number | null | undefined; size?: number; stroke?: number; color?: string; track?: string; label: string; children?: React.ReactNode; trackOpacity?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value ?? 0));
  const col = color ?? healthTone(value).hex;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value ?? "no figure"}${value != null ? "%" : ""}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeOpacity={trackOpacity} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">{children}</span>
    </span>
  );
}

/** One bar split into coloured parts that add up to the whole. */
export function StackBar({ parts, label, height = 10 }: { parts: { value: number; color: string; label: string }[]; label: string; height?: number }) {
  const total = parts.reduce((n, p) => n + Math.max(0, p.value), 0);
  return (
    <span className="flex w-full overflow-hidden rounded-full bg-muted" style={{ height }} role="img" aria-label={`${label}: ${parts.map((p) => `${p.value} ${p.label}`).join(", ")}`}>
      {total > 0 && parts.map((p) => (p.value > 0 ? <span key={p.label} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color, transition: "width 900ms cubic-bezier(.2,.8,.2,1)" }} /> : null))}
    </span>
  );
}

/** The loading state for the principal's pages: the same spinning crest used across the system, with a line saying what is happening. */
export function GroupLoader({ label = "Gathering your schools..." }: { label?: string }) {
  return <PageLoader label={label} />;
}

/** A small spinner with words, for a part of a page that is still working while the rest is ready. */
export function InlineWorking({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden />
      {label}
    </span>
  );
}

/** Group pages only make sense for a principal on "All Schools". A principal who arrives from a link while looking at one school is brought to the group once; after that, choosing a school is respected. */
export function useGroupMode() {
  const router = useRouter();
  const { user, loading, isGroupView, switchSchool } = useAuth();
  const principal = user?.role === "group_principal";
  const settled = useRef(false);
  useEffect(() => {
    if (loading || !user || settled.current) return;
    settled.current = true;
    if (!principal) router.replace("/dashboard");
    else if (!isGroupView) switchSchool(null);
  }, [loading, user, principal, isGroupView, switchSchool, router]);
  return { ready: !loading && !!user && principal && isGroupView };
}

/** Go from the comparison into one school's own page. */
export function useOpenSchool() {
  const router = useRouter();
  const { switchSchool } = useAuth();
  return (schoolId: number, href = "/dashboard") => {
    switchSchool(schoolId);
    router.push(href);
  };
}
