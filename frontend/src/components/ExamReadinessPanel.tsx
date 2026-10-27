"use client";

import { useEffect, useState } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { api, ExamReadiness } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Meter, Pill } from "@/components/oversight";

/** For the grades that sit a national assessment: who still has numbers missing. */
export function ExamReadinessPanel({ schoolId, onOpenLearner }: { schoolId: number; onOpenLearner: (id: number) => void }) {
  const { token } = useAuth();
  const [data, setData] = useState<ExamReadiness | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.getExamReadiness(token, schoolId).then((d) => !cancelled && setData(d)).catch(() => !cancelled && setData({ groups: [] }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId]);

  if (!data || data.groups.length === 0) return null;
  const incomplete = data.groups.reduce((n, g) => n + (g.learners - g.complete), 0);

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="National exam readiness">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><GraduationCap className="size-4.5" aria-hidden /></span>
          <span className="min-w-0"><span className="block font-heading text-base font-semibold">National exam readiness</span><span className="block text-sm text-muted-foreground">{incomplete === 0 ? "Every learner in the exam grades has their numbers" : `${incomplete} learner${incomplete === 1 ? "" : "s"} still missing a number`}</span></span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="grid gap-4 border-t p-4 sm:p-5 lg:grid-cols-3">
          {data.groups.map((g) => (
            <div key={g.grade_code} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2"><h3 className="font-medium">{g.grade_name} · {g.exam}</h3><span className="text-xs text-muted-foreground tabular-nums">{g.complete}/{g.learners} ready</span></div>
              <Meter value={g.complete} total={Math.max(1, g.learners)} label={`${g.grade_name} learners with all numbers`} />
              <p className="text-xs text-muted-foreground">Needs: {g.needs.join(", ")}</p>
              <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {g.rows.filter((r) => r.missing.length > 0).map((r) => (
                  <li key={r.student_id}>
                    <button type="button" onClick={() => onOpenLearner(r.student_id)} className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm hover:bg-accent/40">
                      <span className="font-medium">{r.name} <span className="font-normal text-muted-foreground">· {r.class_name}</span></span>
                      <span className="flex flex-wrap gap-1">{r.missing.map((m) => <Pill key={m} tone="warn">{m}</Pill>)}</span>
                    </button>
                  </li>
                ))}
                {g.rows.every((r) => r.missing.length === 0) && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Everyone is complete.</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
