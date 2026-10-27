"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarSearch } from "lucide-react";
import { api, GroupActivity } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { GroupSkeleton, useGroupMode, useOpenSchool } from "@/components/group/GroupUi";
import { ErrorBox, Pill } from "@/components/oversight";
import { Input } from "@/components/ui/input";

const longDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Everything recorded across all the schools, with the exact time, filtered by school or by kind of entry. */
export function GroupActivityView() {
  const { token } = useAuth();
  const { ready } = useGroupMode();
  const openSchool = useOpenSchool();
  const today = localDateStr();
  const [range, setRange] = useState({ start: addDaysStr(today, -2), end: today });
  const [school, setSchool] = useState<number | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [state, setState] = useState<{ key: string; value: GroupActivity | null } | null>(null);
  const key = `${range.start}|${range.end}`;

  useEffect(() => {
    if (!token || !ready) return;
    let cancelled = false;
    api.getGroupActivity(token, range).then((value) => !cancelled && setState({ key, value })).catch(() => !cancelled && setState({ key, value: null }));
    return () => {
      cancelled = true;
    };
  }, [token, ready, range, key]);

  const data = state && state.key === key ? state.value : undefined;
  const events = useMemo(() => (data?.events ?? []).filter((e) => (school === null || e.school_id === school) && (kind === null || e.kind === kind)), [data, school, kind]);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof events>();
    for (const e of events) {
      const d = localDateStr(new Date(e.at));
      m.set(d, [...(m.get(d) ?? []), e]);
    }
    return [...m.entries()];
  }, [events]);
  const schools = useMemo(() => {
    const seen = new Map<number, string>();
    for (const e of data?.events ?? []) seen.set(e.school_id, e.school_name);
    return [...seen.entries()];
  }, [data]);
  const kinds = Object.entries(data?.counts ?? {}).sort((a, b) => b[1] - a[1]);
  const labelOf = (k: string) => data?.events.find((e) => e.kind === k)?.label ?? k;
  const preset = (days: number) => setRange({ start: addDaysStr(today, -days), end: today });

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">All Schools</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything recorded across your schools, with the exact time of each entry.</p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4" aria-label="Choose the days">
        <div className="flex flex-wrap items-end gap-3">
          <span className="hidden size-9 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex"><CalendarSearch className="size-4.5" aria-hidden /></span>
          <label className="flex flex-col gap-0.5 text-[11px] font-medium text-muted-foreground">From<Input type="date" max={range.end} value={range.start} onChange={(e) => e.target.value && setRange((r) => ({ ...r, start: e.target.value }))} className="h-10 w-40" /></label>
          <label className="flex flex-col gap-0.5 text-[11px] font-medium text-muted-foreground">To<Input type="date" min={range.start} max={today} value={range.end} onChange={(e) => e.target.value && setRange((r) => ({ ...r, end: e.target.value }))} className="h-10 w-40" /></label>
          <div className="flex flex-wrap gap-1.5">
            {[["Today", 0], ["3 days", 2], ["7 days", 6], ["30 days", 29]].map(([label, d]) => <button key={label} type="button" onClick={() => preset(d as number)} className="h-9 rounded-full border px-3.5 text-sm font-medium hover:bg-accent">{label}</button>)}
          </div>
        </div>
        {data && schools.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by school">
            <button type="button" aria-pressed={school === null} onClick={() => setSchool(null)} className={`h-8 rounded-full border px-3 text-xs font-medium ${school === null ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>All schools {data.total}</button>
            {schools.map(([id, name]) => <button key={id} type="button" aria-pressed={school === id} onClick={() => setSchool(school === id ? null : id)} className={`h-8 rounded-full border px-3 text-xs font-medium ${school === id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{name} {data.by_school[String(id)] ?? 0}</button>)}
          </div>
        )}
        {kinds.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by kind">
            <button type="button" aria-pressed={kind === null} onClick={() => setKind(null)} className={`h-8 rounded-full border px-3 text-xs font-medium ${kind === null ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>Everything</button>
            {kinds.map(([k, n]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)} className={`h-8 rounded-full border px-3 text-xs font-medium ${kind === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{labelOf(k)} {n}</button>)}
          </div>
        )}
      </section>

      {data === undefined ? (
        <GroupSkeleton rows={1} />
      ) : data === null ? (
        <ErrorBox message="We couldn't load the activity just now." onRetry={() => setState(null)} />
      ) : events.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-12 text-center text-sm text-muted-foreground">Nothing was recorded for these days.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {byDay.map(([day, list]) => (
            <section key={day}>
              <h2 className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5">{longDay(day)}</h2>
              <ul className="divide-y">
                {list.map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <button type="button" onClick={() => openSchool(e.school_id, e.href || "/dashboard")} className="flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5">
                      <span className="w-12 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums">{timeOf(e.at)}</span>
                      <span className="min-w-0 flex-1"><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{e.school_name}</span><span className="block text-sm font-medium break-words">{e.title}</span><span className="block text-xs break-words text-muted-foreground">{[e.detail, e.actor ? `by ${e.actor}` : ""].filter(Boolean).join(" · ")}</span></span>
                      <span className="hidden shrink-0 sm:block"><Pill tone="muted">{e.label}</Pill></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
