"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Medal, Trophy } from "lucide-react";
import { AcademicTerm, api, ClassPerformance as ClassRow, PerformanceOverview } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LEVEL_BAR, LEVEL_LABEL, LEVEL_ORDER, Pill } from "@/components/oversight";
import { PageLoader } from "@/components/Spinner";

function tone(avg: number | null): "good" | "warn" | "bad" | "muted" {
  if (avg === null) return "muted";
  return avg >= 65 ? "good" : avg >= 50 ? "warn" : "bad";
}

function Bar({ value }: { value: number | null }) {
  const colour = value === null ? "bg-muted" : value >= 65 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <span className={`block h-full rounded-full ${colour}`} style={{ width: `${Math.min(100, value ?? 0)}%` }} />
    </span>
  );
}

const MEDAL = ["text-amber-500", "text-slate-400", "text-orange-600"];

/** How each class is performing and who is on top, before any report card is opened. */
export function ClassPerformance({ schoolId, terms }: { schoolId: number; terms: AcademicTerm[] }) {
  const { token } = useAuth();
  const [term, setTerm] = useState<string>(() => (terms.find((t) => t.is_current) ?? terms[0])?.name ?? "");
  const [types, setTypes] = useState<string[]>([]);
  const [data, setData] = useState<{ key: string; value: PerformanceOverview | null } | null>(null);
  const [sort, setSort] = useState<"class" | "average">("class");
  const key = `${term}|${types.join(",")}`;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .getPerformance(token, schoolId, { term: term || undefined, exam_types: types })
      .then((value) => !cancelled && setData({ key, value }))
      .catch(() => !cancelled && setData({ key, value: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, term, types, key]);

  const ready = data && data.key === key;
  const perf = ready ? data.value : null;
  const toggleType = (t: string) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const rows = [...(perf?.classes ?? [])];
  if (sort === "average") rows.sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  const grouped: Record<string, ClassRow[]> = {};
  for (const c of rows) (grouped[sort === "class" ? c.level : "all"] ??= []).push(c);
  const order = sort === "class" ? LEVEL_ORDER.filter((l) => grouped[l]) : ["all"];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Term
          <select value={term} onChange={(e) => { setTerm(e.target.value); setTypes([]); }} className="h-10 min-w-40 rounded-lg border bg-background px-3 text-sm text-foreground">
            {terms.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Compare by" className="inline-flex rounded-lg border p-0.5">
          {([["class", "Group by level"], ["average", "Rank by average"]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={`h-9 rounded-md px-3 text-sm font-medium ${sort === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
      </div>
      {(perf?.available_exam_types.length ?? 0) > 1 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Exams included">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Exams included</span>
          <button type="button" aria-pressed={types.length === 0} onClick={() => setTypes([])} className={`h-8 rounded-full border px-3 text-xs font-medium ${types.length === 0 ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>All</button>
          {perf?.available_exam_types.map((t) => (
            <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => toggleType(t)} className={`h-8 rounded-full border px-3 text-xs font-medium ${types.includes(t) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      )}

      {!ready ? (
        <PageLoader />
      ) : !perf || perf.classes.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">{perf?.term ? "There are no classes yet." : "Add an academic term, then marks will show here."}</p>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="overflow-hidden rounded-xl border bg-card" aria-label="Classes">
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_5rem_minmax(0,1.6fr)_1.5rem] gap-3 border-b bg-muted/50 px-5 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
              <span>Class</span><span>Average</span><span>Pass rate</span><span>Top learners</span><span />
            </div>
            {order.map((l) => (
              <div key={l}>
                {sort === "class" && <p className="flex items-center gap-2 bg-muted/30 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5"><span className={`h-3 w-1 rounded-full ${LEVEL_BAR[l]}`} />{LEVEL_LABEL[l]}</p>}
                <ul className="divide-y">
                  {grouped[l].map((c) => (
                    <li key={c.class_id}>
                      <Link href={`/dashboard/results/board?class_id=${c.class_id}`} className="grid gap-x-3 gap-y-2 px-4 py-3 text-sm outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_5rem_minmax(0,1.6fr)_1.5rem] md:items-center">
                        <span className="min-w-0">
                          <span className="block font-medium break-words">{c.class_name}</span>
                          <span className="block text-xs text-muted-foreground">{c.teacher ?? "No class teacher"} · {c.marked} of {c.learners} marked</span>
                        </span>
                        <span className="flex flex-col gap-1.5">
                          <span className="flex items-baseline justify-between gap-2"><span className="font-heading text-lg font-semibold tabular-nums">{c.average ?? "—"}</span>{c.average !== null && <Pill tone={tone(c.average)}>{c.average >= 65 ? "Strong" : c.average >= 50 ? "Fair" : "Weak"}</Pill>}</span>
                          <Bar value={c.average} />
                          {c.best_subject && <span className="text-[11px] text-muted-foreground">Best: {c.best_subject.subject} {c.best_subject.average}{c.weakest_subject ? ` · Weakest: ${c.weakest_subject.subject} ${c.weakest_subject.average}` : ""}</span>}
                        </span>
                        <span className="tabular-nums"><span className="text-xs text-muted-foreground md:hidden">Pass rate </span>{c.pass_rate !== null ? `${c.pass_rate}%` : "—"}</span>
                        <span className="min-w-0">
                          {!c.ranked ? <span className="text-xs text-muted-foreground">Pre-primary learners are not ranked</span> : c.top.length === 0 ? <span className="text-xs text-muted-foreground">No marks yet</span> : (
                            <ol className="flex flex-col gap-0.5">
                              {c.top.map((t) => (
                                <li key={t.student_id} className="flex items-center gap-1.5 text-xs"><Medal className={`size-3.5 shrink-0 ${MEDAL[Math.min(t.rank, 3) - 1]}`} aria-hidden /><span className="tabular-nums text-muted-foreground">{t.rank}.</span><span className="min-w-0 truncate">{t.name}</span><span className="ml-auto tabular-nums text-muted-foreground">{t.average}</span></li>
                              ))}
                            </ol>
                          )}
                        </span>
                        <ChevronRight className="hidden size-4 text-muted-foreground md:block" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">School average, {perf.term}</p>
              <p className="font-heading text-3xl font-semibold tabular-nums">{perf.school_average ?? "—"}</p>
              <Bar value={perf.school_average} />
            </div>
            <section className="overflow-hidden rounded-xl border bg-card" aria-label="Top learners in the school">
              <h3 className="flex items-center gap-2 border-b px-4 py-3 font-heading text-base font-semibold"><Trophy className="size-4 text-amber-500" aria-hidden /> Top learners</h3>
              {perf.top_learners.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No ranked marks yet.</p>
              ) : (
                <ol className="divide-y">
                  {perf.top_learners.map((t, i) => (
                    <li key={t.student_id}>
                      <Link href={`/dashboard/report-card/${t.student_id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40">
                        <span className="w-5 text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="min-w-0 flex-1"><span className="block font-medium break-words">{t.name}</span><span className="block text-xs text-muted-foreground">{t.class_name} · position {t.rank} in class</span></span>
                        <span className="font-semibold tabular-nums">{t.average}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
