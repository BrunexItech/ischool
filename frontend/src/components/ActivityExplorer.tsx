"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarSearch, ChevronDown, History } from "lucide-react";
import { ActivityFeed, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { Pill } from "@/components/oversight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TONE: Record<string, "good" | "warn" | "bad" | "muted" | "brand" | "info"> = {
  attendance: "info",
  lessons: "good",
  homework: "brand",
  marks: "info",
  conduct: "warn",
  awards: "good",
  announcements: "brand",
  calendar: "brand",
  trips: "muted",
  transport: "muted",
  complaints: "bad",
  finance: "warn",
  changes: "muted",
};

function mondayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDaysStr(day, -dow);
}

function dayHeading(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** The exact date and time, so a record can be pinned to the minute. */
function stamp(iso: string) {
  const dt = new Date(iso);
  return { day: localDateStr(dt), time: dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) };
}

export function EventList({ feed, showDates }: { feed: ActivityFeed; showDates: boolean }) {
  const byDay = new Map<string, ActivityFeed["events"]>();
  for (const e of feed.events) {
    const k = stamp(e.at).day;
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  return (
    <div className="flex flex-col">
      {[...byDay.entries()].map(([day, events]) => (
        <section key={day}>
          {showDates && <h3 className="border-y bg-muted/40 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5">{dayHeading(day)}</h3>}
          <ul className="divide-y">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <Link href={e.href || "#"} className="flex items-start gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5">
                  <span className="w-12 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums">{stamp(e.at).time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium break-words">{e.title}</span>
                    <span className="block text-xs break-words text-muted-foreground">
                      {[e.detail, e.actor ? `by ${e.actor}` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="hidden shrink-0 sm:block"><Pill tone={TONE[e.kind] ?? "muted"}>{e.label}</Pill></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Recent activity, folded away until asked for. */
export function RecentActivity({ schoolId }: { schoolId: number }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<ActivityFeed | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || feed || !token) return;
    const today = localDateStr();
    api
      .getSchoolActivity(token, schoolId, { start: addDaysStr(today, -2), end: today })
      .then(setFeed)
      .catch(() => setFailed(true));
  }, [open, feed, token, schoolId]);

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><History className="size-4.5" /></span>
          <span className="min-w-0">
            <span className="block font-heading text-lg font-semibold">Recent activity</span>
            <span className="block text-sm text-muted-foreground">The last three days, with the exact time of each entry</span>
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t">
          {failed ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">We couldn&apos;t load the activity just now.</p>
          ) : !feed ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : feed.events.length === 0 ? (
            <EmptyNote>Nothing has been recorded in the last three days.</EmptyNote>
          ) : (
            <EventList feed={feed} showDates />
          )}
        </div>
      )}
    </section>
  );
}

/** Pick a day or a week and see everything that happened. */
export function FindByDate({ schoolId }: { schoolId: number }) {
  const { token } = useAuth();
  const today = localDateStr();
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [kind, setKind] = useState<string | null>(null);
  const [feed, setFeed] = useState<ActivityFeed | null>(null);
  const [failed, setFailed] = useState(false);

  const start = mode === "week" ? mondayOf(date) : date;
  const end = mode === "week" ? addDaysStr(start, 6) : date;

  useEffect(() => {
    if (!token || !date) return;
    api
      .getSchoolActivity(token, schoolId, { start, end })
      .then((f) => {
        setFailed(false);
        setFeed(f);
      })
      .catch(() => setFailed(true));
  }, [token, schoolId, date, start, end]);

  const loading = !feed || feed.start !== start || feed.end !== end;
  const shown = feed ? { ...feed, events: kind ? feed.events.filter((e) => e.kind === kind) : feed.events } : null;
  const kinds = feed ? Object.entries(feed.counts).sort((a, b) => b[1] - a[1]) : [];
  const labelOf = (k: string) => feed?.events.find((e) => e.kind === k)?.label ?? k;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-4 border-b px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarSearch className="size-4.5" /></span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold">Find by date</h2>
            <p className="text-sm text-muted-foreground">Pick any day or week and see everything that was recorded</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Date
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="h-10 w-44" aria-label="Date to look up" />
          </label>
          <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Day or week">
            {(["day", "week"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`h-9 rounded-md px-4 text-sm font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setDate(today); setMode("day"); }}>Today</Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setDate(addDaysStr(today, -1)); setMode("day"); }}>Yesterday</Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setDate(addDaysStr(mondayOf(today), -7)); setMode("week"); }}>Last week</Button>
          </div>
        </div>
        {feed && !loading && (
          <p className="text-sm">
            <span className="font-semibold">{mode === "day" ? dayHeading(start) : `${new Date(start + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${new Date(end + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}</span>
            <span className="text-muted-foreground"> · {feed.total} {feed.total === 1 ? "entry" : "entries"}</span>
          </p>
        )}
        {kinds.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by module">
            <button type="button" onClick={() => setKind(null)} aria-pressed={kind === null} className={`h-8 rounded-full border px-3 text-xs font-medium ${kind === null ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>All {feed?.total}</button>
            {kinds.map(([k, n]) => (
              <button key={k} type="button" onClick={() => setKind(kind === k ? null : k)} aria-pressed={kind === k} className={`h-8 rounded-full border px-3 text-xs font-medium ${kind === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{labelOf(k)} {n}</button>
            ))}
          </div>
        )}
      </div>
      {failed ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">We couldn&apos;t load that date just now.</p>
      ) : loading ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : shown && shown.events.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing was recorded on {mode === "day" ? "this day" : "these days"}.</p>
      ) : (
        shown && <EventList feed={shown} showDates={mode === "week"} />
      )}
    </section>
  );
}
