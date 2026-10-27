"use client";

import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/Spinner";

export interface Period {
  start: string;
  end: string;
}

const MAX_DAYS = 62;

function mondayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return addDaysStr(day, -((new Date(y, m - 1, d).getDay() + 6) % 7));
}

const long = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const short = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function periodLabel(p: Period) {
  const today = localDateStr();
  if (p.start === p.end) return p.end === today ? "Today" : p.end === addDaysStr(today, -1) ? "Yesterday" : long(p.end);
  const monday = mondayOf(today);
  if (p.start === monday && p.end === addDaysStr(monday, 6) || (p.start === monday && p.end === today)) return "This week";
  if (p.start === addDaysStr(monday, -7) && p.end === addDaysStr(monday, -1)) return "Last week";
  return `${short(p.start)} to ${short(p.end)}`;
}

/** The date control at the top of the overview. Every card below follows it. */
export function PeriodBar({ period, onChange: emit, loading }: { schoolId: number; period: Period; onChange: (p: Period) => void; loading: boolean }) {
  const today = localDateStr();
  // Keep the span within what the school can be summed over in one go.
  const onChange = (p: Period) => emit(Math.round((new Date(p.end).getTime() - new Date(p.start).getTime()) / 86400000) + 1 > MAX_DAYS ? { start: addDaysStr(p.end, -(MAX_DAYS - 1)), end: p.end } : p);
  const single = period.start === period.end;
  const days = Math.round((new Date(period.end).getTime() - new Date(period.start).getTime()) / 86400000) + 1;
  const weekLike = !single && days <= 7 && period.start === mondayOf(period.start);
  const mode = single ? "day" : weekLike ? "week" : "custom";
  const thisMonday = mondayOf(today);
  const clampEnd = (d: string) => (d > today ? today : d);

  function step(dir: -1 | 1) {
    if (single) {
      const d = addDaysStr(period.end, dir);
      if (d <= today) onChange({ start: d, end: d });
    } else {
      const shift = days * dir;
      const start = addDaysStr(period.start, shift);
      const end = addDaysStr(period.end, shift);
      if (start <= today) onChange({ start, end: clampEnd(end) });
    }
  }

  const quick: [string, Period][] = [
    ["Today", { start: today, end: today }],
    ["Yesterday", { start: addDaysStr(today, -1), end: addDaysStr(today, -1) }],
    ["This week", { start: thisMonday, end: today }],
    ["Last week", { start: addDaysStr(thisMonday, -7), end: addDaysStr(thisMonday, -1) }],
  ];

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:p-4" aria-label="Choose the day or period to look at">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarRange className="size-4.5" aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Showing</p>
          <p className="font-heading text-base leading-tight font-semibold break-words">
            {periodLabel(period)} {loading && <Spinner size={14} className="ml-1 inline-block align-middle" />}
          </p>
          {periodLabel(period) !== long(period.end) && single && <p className="text-xs text-muted-foreground">{long(period.end)}</p>}
          {!single && <p className="text-xs text-muted-foreground">{short(period.start)} to {short(period.end)}, {days} days</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="size-10" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" className="size-10" aria-label="Next" disabled={period.end >= today} onClick={() => step(1)}><ChevronRight /></Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[11px] font-medium text-muted-foreground">
          {single ? "Date" : "From"}
          <Input type="date" max={today} value={period.start} aria-label={single ? "Date" : "From date"} onChange={(e) => { const v = e.target.value; if (!v) return; onChange(single ? { start: v, end: v } : { start: v, end: v > period.end ? v : period.end }); }} className="h-10 w-40" />
        </label>
        {!single && (
          <label className="flex flex-col gap-0.5 text-[11px] font-medium text-muted-foreground">
            To
            <Input type="date" min={period.start} max={today} value={period.end} aria-label="To date" onChange={(e) => { const v = e.target.value; if (v) onChange({ start: period.start, end: clampEnd(v) }); }} className="h-10 w-40" />
          </label>
        )}
        <div role="group" aria-label="Day or period" className="inline-flex rounded-lg border p-0.5">
          {([["day", "Day"], ["week", "Week"], ["custom", "Range"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={mode === k}
              onClick={() => {
                if (k === "day") onChange({ start: period.end, end: period.end });
                else if (k === "week") onChange({ start: mondayOf(period.end), end: clampEnd(addDaysStr(mondayOf(period.end), 6)) });
                else onChange({ start: addDaysStr(period.end, -6), end: period.end });
              }}
              className={`h-9 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:ml-auto">
        {quick.map(([label, p]) => {
          const on = p.start === period.start && p.end === period.end;
          return <button key={label} type="button" aria-pressed={on} onClick={() => onChange(p)} className={`h-9 rounded-full border px-3 text-sm font-medium ${on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>;
        })}
      </div>
    </section>
  );
}
