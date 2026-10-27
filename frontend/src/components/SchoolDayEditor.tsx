"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError, PeriodDraft, SchoolPeriod } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LEVEL_LABEL } from "@/components/oversight";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LEVELS = ["pre_primary", "primary", "junior_school", "senior_school"] as const;
const KINDS: [string, string][] = [["lesson", "Lesson"], ["prep", "Prep"], ["break", "Break"], ["lunch", "Lunch"], ["assembly", "Assembly"], ["games", "Games"]];
const DAY_CHIPS = ["M", "T", "W", "T", "F"];
const hhmm = (t: string) => t.slice(0, 5);

function fromSaved(periods: SchoolPeriod[], level: string): PeriodDraft[] {
  return periods.filter((p) => p.level_group === level).sort((a, b) => a.position - b.position).map((p) => ({ name: p.name, kind: p.kind, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time), days: p.days }));
}

function LevelDay({ level, saved, schoolId, onSaved }: { level: string; saved: SchoolPeriod[]; schoolId: number; onSaved: () => void }) {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<PeriodDraft[]>(() => fromSaved(saved, level));
  const [withPrep, setWithPrep] = useState(false);
  const [busy, setBusy] = useState<"template" | "save" | null>(null);
  const [dirty, setDirty] = useState(false);
  const isHead = user?.role !== "secretary";

  function edit(i: number, patch: Partial<PeriodDraft>) {
    setRows((r) => r.map((x, n) => (n === i ? { ...x, ...patch } : x)));
    setDirty(true);
  }

  async function loadTemplate() {
    if (!token) return;
    setBusy("template");
    try {
      const t = await api.getPeriodTemplate(token, schoolId, level, withPrep);
      setRows(t.map((p) => ({ ...p, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time) })));
      setDirty(true);
    } catch {
      toast.error("We couldn't load a suggested day.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!token) return;
    setBusy("save");
    try {
      const res = await api.saveSchoolDay(token, schoolId, level, rows);
      toast.success(res.message);
      setDirty(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save the school day.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={`${LEVEL_LABEL[level]} school day`}>
      <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="font-heading text-lg font-semibold">{LEVEL_LABEL[level]}</h2>
          <p className="text-sm text-muted-foreground">{rows.length === 0 ? "Not set yet" : `${rows.length} blocks · ${rows.filter((r) => r.kind === "lesson").length} lessons${rows.some((r) => r.kind === "prep") ? " · with prep" : ""}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withPrep} onChange={(e) => setWithPrep(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Include evening prep</label>
          <Button variant="outline" size="sm" className="h-9" onClick={loadTemplate} disabled={busy !== null}>{busy === "template" && <Spinner size={14} className="text-current" />} Suggest a day</Button>
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Start from a suggested day, then adjust the times to match your school, or add blocks yourself.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r, i) => (
            <li key={i} className={`grid gap-2 px-4 py-2.5 sm:px-5 md:grid-cols-[minmax(0,1.3fr)_7rem_6.5rem_6.5rem_auto_2.25rem] md:items-center ${r.kind === "lesson" || r.kind === "prep" ? "" : "bg-muted/30"}`}>
              <Input value={r.name} onChange={(e) => edit(i, { name: e.target.value })} aria-label="Block name" className="h-10" />
              <select value={r.kind} onChange={(e) => edit(i, { kind: e.target.value })} aria-label="Kind of block" className="h-10 rounded-lg border bg-background px-2 text-sm">
                {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <Input type="time" value={r.start_time} onChange={(e) => edit(i, { start_time: e.target.value })} aria-label="Starts" className="h-10" />
              <Input type="time" value={r.end_time} onChange={(e) => edit(i, { end_time: e.target.value })} aria-label="Ends" className="h-10" />
              <div className="flex gap-1" role="group" aria-label="Days it runs">
                {DAY_CHIPS.map((d, n) => (
                  <button key={n} type="button" aria-pressed={r.days.includes(n)} aria-label={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][n]} onClick={() => edit(i, { days: r.days.includes(n) ? r.days.filter((x) => x !== n) : [...r.days, n].sort() })} className={`size-8 rounded-md border text-xs font-semibold ${r.days.includes(n) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{d}</button>
                ))}
              </div>
              <Button variant="ghost" size="icon" className="size-9" aria-label={`Remove ${r.name}`} onClick={() => { setRows((x) => x.filter((_, n) => n !== i)); setDirty(true); }}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <footer className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <Button variant="outline" size="sm" className="h-9 w-fit" onClick={() => { setRows((r) => [...r, { name: `Lesson ${r.filter((x) => x.kind === "lesson").length + 1}`, kind: "lesson", start_time: r.length ? r[r.length - 1].end_time : "08:00", end_time: r.length ? r[r.length - 1].end_time : "08:40", days: [0, 1, 2, 3, 4] }]); setDirty(true); }}><Plus /> Add a block</Button>
        <div className="flex items-center gap-3">
          {!isHead && dirty && <span className="text-xs text-muted-foreground">This goes to the head of institution for approval.</span>}
          <Button className="h-10 sm:h-9" disabled={!dirty || rows.length === 0 || busy !== null} onClick={save}>{busy === "save" && <Spinner size={16} className="text-current" />} {isHead ? "Save school day" : "Send for approval"}</Button>
        </div>
      </footer>
    </section>
  );
}

/** Lessons, breaks, lunch and prep for every level. */
export function SchoolDayEditor({ schoolId, periods, onSaved }: { schoolId: number; periods: SchoolPeriod[]; onSaved: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Each level can run a different day. Lessons and prep can be given a subject and teacher; breaks, lunch, assembly and games cannot, so they are always protected. Changing a time moves the lessons already placed in that block.</p>
      {LEVELS.map((l) => (
        <LevelDay key={`${l}-${periods.filter((p) => p.level_group === l).map((p) => p.id).join(",")}`} level={l} saved={periods} schoolId={schoolId} onSaved={onSaved} />
      ))}
    </div>
  );
}
