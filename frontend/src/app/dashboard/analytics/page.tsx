"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Minus,
  Printer,
  RotateCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { api, AcademicTerm, AttendanceTrendPoint, FinanceSummary, Insights, ResultsAnalytics, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadInsightsPdf, downloadInsightsXlsx } from "@/lib/analyticsExport";
import { localDateStr } from "@/lib/dates";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";
const FILTER_KEY = "milai-analytics-filters";

const LEVEL_COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#f43f5e"];
const GRADE_COLOR: Record<string, string> = { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", E: "#ef4444" };
const REASON_LABEL: Record<string, string> = { teacher_absent: "Teacher away", public_holiday: "Public holiday", exams: "Exams", school_event: "School event", other: "Other" };

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };
const axisProps = { axisLine: false, tickLine: false, fontSize: 12, stroke: "var(--muted-foreground)" };

interface ClassOption {
  id: number;
  name: string;
}

// ---------- small building blocks ----------

function Panel({ title, caption, children, className = "" }: { title: string; caption?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5 print:break-inside-avoid ${className}`}>
      <div>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {caption && <p className="mt-0.5 text-sm text-muted-foreground">{caption}</p>}
      </div>
      {children}
    </section>
  );
}

function Delta({ value, previous, label, goodWhen = "up", unit = "" }: { value: number | null; previous: number | null; label: string | null; goodWhen?: "up" | "down"; unit?: string }) {
  if (value === null || previous === null || label === null) return <span className="text-xs text-muted-foreground">No earlier term to compare</span>;
  const diff = Math.round((value - previous) * 10) / 10;
  if (diff === 0) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3.5" /> Same as {label}</span>;
  const good = goodWhen === "up" ? diff > 0 : diff < 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
      <Icon className="size-3.5" /> {diff > 0 ? "+" : ""}{diff}{unit} since {label}
    </span>
  );
}

function ScoreTile({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 sm:p-5 print:break-inside-avoid">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl font-semibold tabular-nums">{value}</p>
      <div>{sub}</div>
    </div>
  );
}

function AttentionCard({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card print:break-inside-avoid">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {count > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">{count}</span>}
      </div>
      {count === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y">{children}</ul>}
    </div>
  );
}

function Row({ href, main, sub, right }: { href?: string; main: string; sub: string; right: string }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium break-words">{main}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{right}</span>
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-2.5";
  return <li>{href ? <Link href={href} className={`${cls} transition-colors hover:bg-accent/50`}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
}

function shortDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function HeatCalendar({ days }: { days: Insights["attendance"]["calendar"] }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = new Date(days[0].date + "T12:00:00");
  const last = new Date(days[days.length - 1].date + "T12:00:00");
  const monday = new Date(first);
  monday.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks: Date[][] = [];
  for (const c = new Date(monday); c <= last; c.setDate(c.getDate() + 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => new Date(c.getFullYear(), c.getMonth(), c.getDate() + i, 12)));
  }
  const showWeekend = days.some((d) => ((new Date(d.date + "T12:00:00").getDay() + 6) % 7) >= 5);
  const rows = showWeekend ? 7 : 5;
  const colour = (rate: number | null) =>
    rate === null ? "bg-muted/60" : rate >= 95 ? "bg-emerald-500" : rate >= 90 ? "bg-emerald-400" : rate >= 80 ? "bg-amber-300" : "bg-red-400";
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex gap-1.5">
        <div className="flex flex-col gap-1 pt-0.5 text-[10px] leading-4 text-muted-foreground">
          {dayLabels.slice(0, rows).map((d) => <span key={d} className="h-4 sm:h-5">{d}</span>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.slice(0, rows).map((d) => {
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const rec = byDate.get(iso);
              return (
                <span
                  key={iso}
                  title={rec ? `${shortDate(iso)}: ${rec.rate}% present (${rec.marked} learners)` : `${shortDate(iso)}: not marked`}
                  className={`size-4 rounded-sm sm:size-5 ${colour(rec ? rec.rate : null)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {[
          ["bg-emerald-500", "95% or more"],
          ["bg-emerald-400", "90–94%"],
          ["bg-amber-300", "80–89%"],
          ["bg-red-400", "Under 80%"],
          ["bg-muted/60", "Not marked"],
        ].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><span className={`size-3 rounded-sm ${c}`} />{l}</span>)}
      </div>
    </div>
  );
}

// ---------- classic bar charts (toggled) ----------

function ChartCard({ title, description, empty, children }: { title: string; description: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h3 className="font-heading text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {empty ? <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p> : children}
    </div>
  );
}

function BarCharts({ term, showFinance }: { term: string | null; showFinance: boolean }) {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [data, setData] = useState<{ results: ResultsAnalytics | null; trend: AttendanceTrendPoint[]; finance: FinanceSummary | null; term: string | null } | null>(null);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    Promise.all([
      api.getResultsAnalytics(token, schoolId, term ?? undefined).catch(() => null),
      api.getAttendanceTrend(token, schoolId).catch(() => [] as AttendanceTrendPoint[]),
      showFinance ? api.getFinanceSummary(token, schoolId).catch(() => null) : Promise.resolve(null),
    ]).then(([results, trend, finance]) => !cancelled && setData({ results, trend, finance, term }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, term, showFinance]);

  if (!data || data.term !== term) return <div className="py-8"><PageLoader /></div>;
  const { results, trend, finance } = data;
  const attendanceData = trend.map((p) => ({ label: new Date(p.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" }), rate: p.rate, isToday: p.date === localDateStr() }));
  const financeData = (finance?.monthly ?? []).map((m) => ({ month: m.month, Income: m.income, Expenses: m.expenses }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Average by subject" description="Mean score per subject" empty={!results?.subject_averages.length}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={results?.subject_averages} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="subject" {...axisProps} />
            <YAxis domain={[0, 100]} {...axisProps} />
            <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Average"]} />
            <Bar dataKey="average" radius={[4, 4, 0, 0]} fill="var(--primary)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Average by class" description="Mean score per class" empty={!results?.class_averages.length}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={results?.class_averages} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="class_name" {...axisProps} />
            <YAxis domain={[0, 100]} {...axisProps} />
            <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Average"]} />
            <Bar dataKey="average" radius={[4, 4, 0, 0]} fill="#c4787a" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Grade distribution" description="Count of results by grade" empty={!results?.grade_distribution.length}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={results?.grade_distribution} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="grade" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Results"]} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {results?.grade_distribution.map((g) => <Cell key={g.grade} fill={GRADE_COLOR[g.grade] ?? "var(--primary)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Trend across terms" description="Overall average, term over term" empty={!results?.term_trend.length}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={results?.term_trend} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="term" {...axisProps} />
            <YAxis domain={[0, 100]} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Average"]} />
            <Line type="monotone" dataKey="average" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Attendance, last 7 days" description="Share of learners present or late" empty={!attendanceData.length}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={attendanceData} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
            <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)}%` : "Not marked", "Attendance"]} />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
              {attendanceData.map((d, i) => <Cell key={i} fill={d.isToday ? "var(--primary)" : "#c4787a"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      {showFinance && (
        <ChartCard title="Income vs. expenses" description="By month, from recorded fees and approved expenses" empty={!financeData.length}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={financeData} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`KES ${Number(v).toLocaleString()}`, undefined]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {results && results.top_students.length > 0 && (
        <ChartCard title="Top performers" description="Highest averages" empty={false}>
          <ul className="flex flex-col gap-2">
            {results.top_students.map((s, i) => (
              <li key={s.student_name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">{i + 1}</span> {s.student_name}</span>
                <span className="font-medium tabular-nums">{s.average}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}
    </div>
  );
}

// ---------- the page ----------

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isTeacher = user?.role === "teacher";
  const financeOnly = user?.role === "bursar";
  const canSeeFinance = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "bursar" || user?.role === "group_principal";

  const [setup, setSetup] = useState<{ terms: AcademicTerm[]; classes: ClassOption[]; subjects: Subject[] } | null>(null);
  const [term, setTerm] = useState("");
  const [classId, setClassId] = useState(ALL);
  const [subjectId, setSubjectId] = useState(ALL);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [data, setData] = useState<{ key: string; insights: Insights | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "bursar", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    Promise.all([
      api.listAcademicTerms(token, schoolId).catch(() => [] as AcademicTerm[]),
      isTeacher
        ? api.listMyClasses(token, schoolId).catch(() => []).then((mine) => ({
            classes: mine.map((c) => ({ id: c.class_id, name: c.class_name })),
            subjects: Array.from(new Map(mine.flatMap((c) => c.subjects).map((s) => [s.subject_id, { id: s.subject_id, school_id: schoolId, name: s.subject_name }])).values()),
          }))
        : Promise.all([api.listClasses(token, schoolId).catch(() => []), api.listSubjects(token, schoolId).catch(() => [] as Subject[])]).then(([cs, ss]) => ({
            classes: cs.map((c) => ({ id: c.id, name: c.name })),
            subjects: ss,
          })),
    ]).then(([terms, rest]) => {
      if (cancelled) return;
      let saved: { term?: string; classId?: string; subjectId?: string } = {};
      try {
        saved = JSON.parse(localStorage.getItem(`${FILTER_KEY}-${user?.id}`) ?? "{}");
      } catch {
        saved = {};
      }
      const current = terms.find((t) => t.is_current) ?? terms[0];
      setSetup({ terms, ...rest });
      setTerm(terms.some((t) => t.name === saved.term) ? (saved.term as string) : (current?.name ?? ""));
      if (saved.classId && (saved.classId === ALL || rest.classes.some((c) => String(c.id) === saved.classId))) setClassId(saved.classId);
      if (saved.subjectId && (saved.subjectId === ALL || rest.subjects.some((s) => String(s.id) === saved.subjectId))) setSubjectId(saved.subjectId);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, user?.id]);

  useEffect(() => {
    if (!setup) return;
    try {
      localStorage.setItem(`${FILTER_KEY}-${user?.id}`, JSON.stringify({ term, classId, subjectId }));
    } catch {
      /* remembering filters is a convenience only */
    }
  }, [setup, term, classId, subjectId, user?.id]);

  const key = `${term}/${classId}/${subjectId}/${reloadKey}`;
  useEffect(() => {
    if (!token || !schoolId || !term || financeOnly) return;
    let cancelled = false;
    api
      .getInsights(token, schoolId, { term, class_id: classId === ALL ? undefined : Number(classId), subject_id: subjectId === ALL ? undefined : Number(subjectId) })
      .then((insights) => !cancelled && setData({ key, insights }))
      .catch(() => !cancelled && setData({ key, insights: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, term, classId, subjectId, key, financeOnly]);

  const scopeLabel = useMemo(() => {
    const cls = classId === ALL ? "All classes" : (setup?.classes.find((c) => String(c.id) === classId)?.name ?? "");
    const sub = subjectId === ALL ? "All subjects" : (setup?.subjects.find((s) => String(s.id) === subjectId)?.name ?? "");
    return `${cls} · ${sub}`;
  }, [setup, classId, subjectId]);

  if (loading || !setup) return <PageLoader />;

  const ready = data && data.key === key;
  const insights = ready ? data.insights : null;

  async function exportAs(kind: "pdf" | "xlsx") {
    if (!insights) return;
    setExporting(kind);
    try {
      await (kind === "pdf" ? downloadInsightsPdf(insights, scopeLabel) : downloadInsightsXlsx(insights, scopeLabel));
    } catch {
      toast.error("The file could not be created. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  const header = (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {financeOnly ? "Income and expense trends from your own records." : isTeacher ? "How your classes are doing, and who needs help." : "How the school is doing, and what needs attention."}
        </p>
      </div>
      {!financeOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 sm:h-9" onClick={() => window.print()} disabled={!insights}><Printer /> Print</Button>
          <Button variant="outline" className="h-10 sm:h-9" onClick={() => exportAs("pdf")} disabled={!insights || exporting !== null}>
            {exporting === "pdf" ? <Spinner size={16} className="text-current" /> : <FileText />} PDF
          </Button>
          <Button variant="outline" className="h-10 sm:h-9" onClick={() => exportAs("xlsx")} disabled={!insights || exporting !== null}>
            {exporting === "xlsx" ? <Spinner size={16} className="text-current" /> : <FileSpreadsheet />} Excel
          </Button>
        </div>
      )}
    </header>
  );

  if (financeOnly) {
    return (
      <div className="flex flex-col gap-5 sm:gap-6">
        {header}
        <BarCharts term={null} showFinance />
      </div>
    );
  }

  const sc = insights?.scorecard;
  const prevLabel = sc?.previous_term ?? null;
  const levelBandIndex = (code: string) => Math.max(0, insights?.bands.findIndex((b) => b.level_code === code) ?? 0);

  // Plain-language captions, written from the figures on screen.
  const examCaption = (() => {
    const e = insights?.exam_types ?? [];
    if (e.length < 2) return "Record marks under an exam type in Grading and the comparison appears here.";
    const best = [...e].sort((a, b) => b.average - a.average)[0];
    const worst = [...e].sort((a, b) => a.average - b.average)[0];
    return `Learners scored highest in ${best.exam_type} (${best.average}) and lowest in ${worst.exam_type} (${worst.average}).`;
  })();
  const classCaption = (() => {
    const c = insights?.classes ?? [];
    if (c.length < 2 || insights?.school_average == null) return c.length === 1 ? `${c[0].class_name} averages ${c[0].average}.` : "";
    const worst = c[c.length - 1];
    const gap = Math.round((insights.school_average - worst.average) * 10) / 10;
    return `${c[0].class_name} leads at ${c[0].average}. ${worst.class_name} is ${gap > 0 ? `${gap} points below` : "level with"} the school average of ${insights.school_average}.`;
  })();
  const levelCaption = (() => {
    const l = insights?.levels ?? [];
    const total = l.reduce((n, x) => n + x.total, 0);
    if (!total || !insights) return "";
    const top = insights.bands.slice(0, 2).map((b) => b.level_code);
    const good = l.reduce((n, x) => n + top.reduce((m, c) => m + (x.counts[c] ?? 0), 0), 0);
    return `${Math.round((good / total) * 100)}% of subject results are at ${insights.bands[1]?.label ?? "the expected level"} or above.`;
  })();
  const calendarCaption = (() => {
    const c = insights?.attendance.calendar ?? [];
    if (c.length === 0) return "No registers have been taken in this period.";
    const low = [...c].sort((a, b) => a.rate - b.rate)[0];
    return `Lowest attendance was ${shortDate(low.date)}, at ${low.rate}%.`;
  })();
  const corr = insights?.attendance.correlation;
  const scatterCaption =
    corr === null || corr === undefined
      ? "Not enough learners with both attendance and marks to compare yet."
      : Math.abs(corr) < 0.2
      ? "No clear link between attendance and marks in this data."
      : corr > 0
      ? `Learners who attend more tend to score ${Math.abs(corr) >= 0.5 ? "clearly " : ""}higher (correlation ${corr}).`
      : `Learners who attend more tend to score lower here (correlation ${corr}), which is worth a closer look.`;
  const delivery = insights?.delivery;
  const marked = delivery ? delivery.taught + delivery.partly + delivery.not_taught : 0;
  const topMiss = delivery ? Object.entries(delivery.reasons).sort((a, b) => b[1] - a[1])[0] : undefined;
  const reasonsMax = Math.max(1, ...(insights?.attendance.reasons.map((r) => r.count) ?? [1]));

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {header}
      <section className="flex flex-col gap-3 print:hidden">
        <button
          type="button"
          aria-expanded={chartsOpen}
          aria-controls="bar-charts"
          onClick={() => setChartsOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BarChart3 className="size-4.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-base font-semibold">Bar charts</span>
            <span className="block text-sm text-muted-foreground">Averages by subject and class, grades, term trend and attendance.</span>
          </span>
          <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${chartsOpen ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {chartsOpen && (
          <div id="bar-charts">
            <BarCharts term={term || null} showFinance={canSeeFinance} />
          </div>
        )}
      </section>

      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5 print:hidden" aria-label="Filters">
        <label className="grid gap-1.5 text-sm font-medium">
          Term
          <Select value={term} onValueChange={(v) => v && setTerm(v)}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose a term" /></SelectTrigger>
            <SelectContent>{setup.terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Class
          <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{isTeacher ? "All my classes" : "All classes"}</SelectItem>
              {setup.classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Subject
          <Select value={subjectId} onValueChange={(v) => v && setSubjectId(v)}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{isTeacher ? "All my subjects" : "All subjects"}</SelectItem>
              {setup.subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </section>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Analytics: {term}</h1>
        <p className="text-sm">{scopeLabel}</p>
      </div>

      {setup.terms.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">Add an academic term first, so results and attendance can be grouped by term.</div>
      ) : !ready ? (
        <PageLoader />
      ) : !insights ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the analytics.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4" aria-label="Scorecard">
            <ScoreTile label="School average" value={sc!.average.value !== null ? String(sc!.average.value) : "—"} sub={<Delta value={sc!.average.value} previous={sc!.average.previous} label={prevLabel} />} />
            <ScoreTile label="Attendance rate" value={sc!.attendance_rate.value !== null ? `${sc!.attendance_rate.value}%` : "—"} sub={<Delta value={sc!.attendance_rate.value} previous={sc!.attendance_rate.previous} label={prevLabel} unit=" pts" />} />
            <ScoreTile
              label="Syllabus covered"
              value={sc!.coverage.total ? `${Math.round((sc!.coverage.completed / sc!.coverage.total) * 100)}%` : "—"}
              sub={<span className="text-xs text-muted-foreground">{sc!.coverage.total ? `${sc!.coverage.completed} of ${sc!.coverage.total} topics${sc!.coverage.expected !== null ? `, ${sc!.coverage.expected} expected by now` : ""}` : "No lesson plans yet"}</span>}
            />
            <ScoreTile
              label="Below expectation"
              value={sc!.below_expectation !== null ? String(sc!.below_expectation) : "—"}
              sub={<Delta value={sc!.below_expectation} previous={sc!.below_expectation_previous} label={prevLabel} goodWhen="down" />}
            />
          </section>

          <section className="flex flex-col gap-3" aria-label="Needs attention">
            <div>
              <h2 className="font-heading text-lg font-semibold">Needs attention</h2>
              <p className="text-sm text-muted-foreground">The people and subjects to look at first, with a link to act on each.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 sm:gap-4">
              <AttentionCard title="Marks have fallen" count={insights.attention.dropped_learners.length} empty="No learner has dropped by 10 points or more.">
                {insights.attention.dropped_learners.map((d) => (
                  <Row key={d.student_id} href={`/dashboard/report-card/${d.student_id}`} main={d.name} sub={`${d.class_name} · ${d.previous} to ${d.average}`} right={`-${d.drop}`} />
                ))}
              </AttentionCard>
              <AttentionCard title="Absent three days or more in a row" count={insights.attention.absence_streaks.length} empty="No learner has a long run of absences.">
                {insights.attention.absence_streaks.map((a) => (
                  <Row key={a.student_id} href="/dashboard/students" main={a.name} sub={`${a.class_name} · since ${shortDate(a.since)}`} right={`${a.days} days`} />
                ))}
              </AttentionCard>
              <AttentionCard title="Subjects needing support" count={insights.attention.weak_subjects.length} empty="Every subject is at or above the expected level.">
                {insights.attention.weak_subjects.map((w) => (
                  <Row
                    key={`${w.class_id}-${w.subject_id}`}
                    href={`/dashboard/results/board?class_id=${w.class_id}`}
                    main={`${w.subject_name}, ${w.class_name}`}
                    sub={w.previous !== null ? `${w.previous} to ${w.average} · ${w.learners} learners` : `${w.learners} learners`}
                    right={String(w.average)}
                  />
                ))}
              </AttentionCard>
              <AttentionCard title="Behind on the syllabus" count={insights.attention.behind_teachers.length} empty="Everyone is on track with their plan.">
                {insights.attention.behind_teachers.map((b, i) => (
                  <Row key={i} href={b.plan_id ? `/dashboard/lesson-plans/${b.plan_id}` : undefined} main={`${b.subject_name}, ${b.class_name}`} sub={`${b.teacher_name} · ${b.completed} of ${b.expected} expected topics`} right={`${b.behind} behind`} />
                ))}
              </AttentionCard>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2 sm:gap-5">
            <Panel title="Exam types compared" caption={examCaption}>
              {insights.exam_types.length > 0 && (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={insights.exam_types} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="exam_type" {...axisProps} />
                    <YAxis domain={[0, 100]} {...axisProps} />
                    <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${v} (${p.payload.count} marks)`, "Average"]} />
                    <Bar dataKey="average" radius={[4, 4, 0, 0]} fill="var(--primary)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title="Class against class" caption={classCaption}>
              {insights.classes.length > 0 && (
                <ResponsiveContainer width="100%" height={Math.max(180, insights.classes.length * 38)}>
                  <BarChart data={insights.classes} layout="vertical" margin={{ left: 4, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 100]} {...axisProps} />
                    <YAxis type="category" dataKey="class_name" width={96} {...axisProps} />
                    <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${v} (${p.payload.count} learners)`, "Average"]} />
                    {insights.school_average !== null && <ReferenceLine x={insights.school_average} stroke="var(--foreground)" strokeDasharray="4 3" />}
                    <Bar dataKey="average" radius={[0, 4, 4, 0]} fill="#c4787a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {insights.school_average !== null && insights.classes.length > 0 && <p className="text-xs text-muted-foreground">Dashed line: school average ({insights.school_average}).</p>}
            </Panel>

            <Panel title="Performance levels by subject" caption={levelCaption} className="lg:col-span-2">
              {insights.levels.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No marks recorded for this term yet.</p>
              ) : (
                <>
                  <ul className="flex flex-col gap-3">
                    {insights.levels.map((l) => (
                      <li key={l.subject_id} className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-4">
                        <span className="text-sm font-medium break-words">{l.subject}</span>
                        <div className="flex h-5 overflow-hidden rounded-md bg-muted" role="img" aria-label={insights.bands.map((b) => `${l.counts[b.level_code] ?? 0} ${b.label}`).join(", ")}>
                          {insights.bands.map((b) => {
                            const n = l.counts[b.level_code] ?? 0;
                            return n > 0 ? (
                              <span key={b.level_code} className="flex items-center justify-center text-[10px] font-semibold text-white" style={{ width: `${(n / l.total) * 100}%`, background: LEVEL_COLORS[levelBandIndex(b.level_code) % LEVEL_COLORS.length] }} title={`${b.label}: ${n} learners`}>
                                {n / l.total > 0.08 ? n : ""}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {insights.bands.map((b, i) => (
                      <span key={b.level_code} className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />{b.level_code} {b.label}</span>
                    ))}
                  </div>
                </>
              )}
            </Panel>

            <Panel title="Attendance through the term" caption={calendarCaption} className="lg:col-span-2">
              {insights.attendance.calendar.length > 0 ? <HeatCalendar days={insights.attendance.calendar} /> : <p className="py-6 text-center text-sm text-muted-foreground">No registers taken in this period.</p>}
            </Panel>

            <Panel title="Attendance and marks" caption={scatterCaption}>
              {insights.attendance.scatter.length >= 3 && (
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ left: -10, right: 12, top: 8 }}>
                    <CartesianGrid stroke="var(--border)" />
                    <XAxis type="number" dataKey="attendance" name="Attendance" unit="%" domain={[40, 100]} {...axisProps} />
                    <YAxis type="number" dataKey="average" name="Average" domain={[0, 100]} {...axisProps} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltipStyle} />
                    <Scatter data={insights.attendance.scatter} fill="var(--primary)" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title="Why learners were away" caption={insights.attendance.reasons.length ? "The most common reasons given when a register was marked." : "No reasons recorded yet."}>
              <ul className="flex flex-col gap-2.5">
                {insights.attendance.reasons.map((r) => (
                  <li key={r.reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                    <span className="text-sm break-words">{r.reason}</span>
                    <span className="text-sm font-semibold tabular-nums">{r.count}</span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(r.count / reasonsMax) * 100}%` }} /></span>
                  </li>
                ))}
              </ul>
              {insights.attendance.without_reason > 0 && <p className="text-xs text-muted-foreground">{insights.attendance.without_reason} absences, late arrivals or excuses had no reason written down.</p>}
            </Panel>

            <Panel
              title="Teaching delivery"
              caption={marked ? `${delivery!.taught} of ${marked} marked lessons were fully taught${topMiss ? `. Most missed lessons: ${REASON_LABEL[topMiss[0]] ?? topMiss[0]} (${topMiss[1]})` : ""}.` : "Teachers mark lessons as taught in Lesson Plans. Figures appear here as they do."}
              className="lg:col-span-2"
            >
              {marked > 0 && (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${delivery!.taught} taught, ${delivery!.partly} partly, ${delivery!.not_taught} not taught`}>
                    <span className="bg-emerald-500" style={{ width: `${(delivery!.taught / marked) * 100}%` }} />
                    <span className="bg-amber-400" style={{ width: `${(delivery!.partly / marked) * 100}%` }} />
                    <span className="bg-slate-400" style={{ width: `${(delivery!.not_taught / marked) * 100}%` }} />
                  </div>
                  <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Taught</dt><dd className="font-heading text-xl font-semibold tabular-nums">{delivery!.taught}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Partly taught</dt><dd className="font-heading text-xl font-semibold tabular-nums">{delivery!.partly}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Not taught</dt><dd className="font-heading text-xl font-semibold tabular-nums">{delivery!.not_taught}</dd></div>
                    {Object.entries(delivery!.reasons).map(([k, v]) => (
                      <div key={k}><dt className="text-xs text-muted-foreground">Missed: {REASON_LABEL[k] ?? k}</dt><dd className="font-heading text-xl font-semibold tabular-nums">{v}</dd></div>
                    ))}
                  </dl>
                </>
              )}
            </Panel>
          </div>
        </>
      )}

    </div>
  );
}
