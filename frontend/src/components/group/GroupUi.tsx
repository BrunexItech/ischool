"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GroupColumn } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

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

/** Colour for a percentage: green when healthy, amber when slipping, red when low. */
export function healthTone(p: number | null | undefined) {
  if (p === null || p === undefined) return { bar: "bg-muted-foreground/30", text: "text-muted-foreground" };
  if (p >= 85) return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" };
  if (p >= 65) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" };
  return { bar: "bg-red-500", text: "text-red-700 dark:text-red-400" };
}

export function Bar({ value, label }: { value: number | null | undefined; label: string }) {
  const t = healthTone(value);
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${value ?? "no figure"}${value != null ? "%" : ""}`}>
      <span className={`block h-full rounded-full transition-all ${t.bar}`} style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} aria-hidden />;
}

/** The loading state for group pages: the page shape appears at once, the figures fill in. */
export function GroupSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
    </div>
  );
}

/** Group pages only make sense for a principal on "All Schools": a principal who was looking at one school is brought back, anyone else is sent home. */
export function useGroupMode() {
  const router = useRouter();
  const { user, loading, isGroupView, switchSchool } = useAuth();
  const principal = user?.role === "group_principal";
  useEffect(() => {
    if (loading || !user) return;
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
