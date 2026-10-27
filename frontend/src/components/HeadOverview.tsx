"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Megaphone, Minus, UserPlus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AcademicTerm, api, ClassCard, DashboardSummary, HeadOverview, HomeworkGrid, Insights } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { localDateStr } from "@/lib/dates";
import { LEVEL_BAR, LEVEL_LABEL, LEVEL_ORDER, Meter, Pill } from "@/components/oversight";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

interface Data {
  overview: HeadOverview | null;
  summary: DashboardSummary | null;
  insights: Insights | null;
  cards: ClassCard[] | null;
  homework: HomeworkGrid | null;
  term: AcademicTerm | null;
}

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

function Delta({ value, previous, goodWhen = "up", unit = "" }: { value: number | null; previous: number | null; goodWhen?: "up" | "down"; unit?: string }) {
  if (value === null || previous === null) return <span className="text-xs text-muted-foreground">No earlier term</span>;
  const diff = Math.round((value - previous) * 10) / 10;
  if (diff === 0) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3.5" /> Unchanged</span>;
  const good = goodWhen === "up" ? diff > 0 : diff < 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
      <Icon className="size-3.5" /> {diff > 0 ? "+" : ""}{diff}{unit} vs last term
    </span>
  );
}

function Tile({ label, value, sub, href, tone, children }: { label: string; value: string; sub: React.ReactNode; href: string; tone?: "warn"; children?: React.ReactNode }) {
  return (
    <Link href={href} className="group flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex items-center justify-between text-sm text-muted-foreground">{label}<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
      <span className={`font-heading text-3xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
      {children}
    </Link>
  );
}

function Panel({ title, caption, action, children, className = "" }: { title: string; caption?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-xl border bg-card ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const INBOX_LABEL: Record<string, string> = { trip: "Trip", expense: "Expense", complaint: "Complaint", conduct: "Conduct", staff: "Staff" };

export function HeadOverviewView({ schoolId }: { schoolId: number }) {
  const { user, token } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const terms = await api.listAcademicTerms(token, schoolId).catch(() => [] as AcademicTerm[]);
      const term = terms.find((t) => t.is_current) ?? terms[0] ?? null;
      const [overview, summary, insights, cards, homework] = await Promise.all([
        api.getHeadOverview(token, schoolId).catch(() => null),
        api.getDashboardSummary(token, schoolId).catch(() => null),
        term ? api.getInsights(token, schoolId, { term: term.name }).catch(() => null) : Promise.resolve(null),
        api.getClassCards(token, schoolId).catch(() => null),
        api.getHomeworkGrid(token, schoolId).catch(() => null),
      ]);
      if (!cancelled) setData({ overview, summary, insights, cards, homework, term });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, schoolId]);

  const grouped = useMemo(() => {
    const out: Record<string, ClassCard[]> = {};
    for (const c of data?.cards ?? []) (out[c.level] ??= []).push(c);
    return out;
  }, [data]);

  if (!data) return <PageLoader />;
  const { overview, summary, insights, cards, homework, term } = data;
  const p = overview?.pulse;
  const inboxTotal = overview ? overview.inbox.length : 0;
  const weekOf = term?.start_date && term?.end_date ? { week: Math.max(1, Math.ceil((now - new Date(term.start_date).getTime()) / 604800000)), of: Math.max(1, Math.round((new Date(term.end_date).getTime() - new Date(term.start_date).getTime()) / 604800000)) } : null;
  const trend = (summary?.attendance_trend ?? []).map((t) => ({ date: t.date, label: new Date(t.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" }), rate: t.rate, isToday: t.date === localDateStr() }));
  const hwRecorded = homework ? homework.summary.given + homework.summary.board + homework.summary.none : 0;
  const sc = insights?.scorecard;
  const attention = insights?.attention;
  const staffIn = p ? p.staff_present + p.staff_late : 0;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{greet()}, {user?.full_name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {term && <> · {term.name}{weekOf ? `, week ${Math.min(weekOf.week, weekOf.of)} of ${weekOf.of}` : ""}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 sm:h-9" nativeButton={false} render={<Link href="/dashboard/announcements"><Megaphone /> Announce</Link>} />
          <Button className="h-10 sm:h-9" nativeButton={false} render={<Link href="/dashboard/students"><UserPlus /> Enrol a learner</Link>} />
        </div>
      </header>

      {p && !p.school_day && (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{p.holiday ? `${p.holiday} is a holiday on the school calendar.` : "Today is not a school day."} The figures below show the most recent information.</p>
      )}

      {/* Today */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Today at a glance">
        <Tile
          label="Attendance today"
          value={p?.attendance_rate != null ? `${p.attendance_rate}%` : "—"}
          sub={p ? (p.school_day ? `${p.registers_taken} of ${p.registers_total} registers in` : "No school today") : "Unavailable"}
          href="/dashboard/attendance"
          tone={p && p.school_day && p.registers_taken < p.registers_total ? "warn" : undefined}
        >
          {p && p.school_day && p.registers_total > 0 && <Meter value={p.registers_taken} total={p.registers_total} label="Registers taken" />}
        </Tile>
        <Tile label="Teachers in today" value={p ? String(staffIn) : "—"} sub={p ? `${p.staff_absent} absent · ${p.staff_on_leave} on leave${p.staff_expected ? ` · ${p.staff_expected} not in yet` : ""}` : "Unavailable"} href="/dashboard/staff-attendance" tone={p && p.staff_absent > 0 ? "warn" : undefined} />
        <Tile
          label="Lessons marked today"
          value={p ? `${p.lessons_marked}/${p.lessons_scheduled}` : "—"}
          sub={p ? (p.unmarked_yesterday > 0 ? `${p.unmarked_yesterday} from yesterday not marked` : "Nothing outstanding from yesterday") : "Unavailable"}
          href="/dashboard/lesson-plans"
        />
        <Tile
          label="Homework this week"
          value={homework ? `${hwRecorded}/${homework.summary.expected}` : "—"}
          sub={homework ? (homework.summary.missing > 0 ? `${homework.summary.missing} lessons with nothing recorded` : "Every lesson accounted for") : "Unavailable"}
          href="/dashboard/homework"
          tone={homework && homework.summary.missing > 0 ? "warn" : undefined}
        />
        <Tile label="Waiting for you" value={String(inboxTotal)} sub={inboxTotal ? "decisions and replies" : "Nothing needs your decision"} href="#decisions" tone={inboxTotal > 0 ? "warn" : undefined} />
      </section>

      {/* Decisions and exceptions */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div id="decisions">
          <Panel title="Needs your decision" caption="Oldest first. Each opens the item so you can approve, decline or reply.">
            {!overview ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">We couldn&apos;t load this just now.</p>
            ) : overview.inbox.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing is waiting on you. Trips, expenses, complaints and conduct reports will appear here.</p>
            ) : (
              <ul className="divide-y">
                {overview.inbox.map((i, n) => (
                  <li key={n}>
                    <Link href={i.href} className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 sm:px-5">
                      <span className="w-20 shrink-0"><Pill tone={i.kind === "staff" ? "warn" : "brand"}>{INBOX_LABEL[i.kind] ?? i.kind}</Pill></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium break-words">{i.title}</span><span className="block text-xs break-words text-muted-foreground">{i.detail}</span></span>
                      <span className={`shrink-0 text-xs tabular-nums ${i.age_days >= 3 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{i.age_days === 0 ? "today" : `${i.age_days} d`}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Today's exceptions" caption="What to chase this morning">
          <ul className="divide-y">
            <li className="px-4 py-3 sm:px-5">
              <p className="text-sm font-medium">Registers not taken</p>
              {summary && summary.pending_registers.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {summary.pending_registers.slice(0, 5).map((r) => (
                    <li key={r.class_id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words">{r.class_name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{r.teacher_name ?? "No class teacher"}</span>
                    </li>
                  ))}
                  {summary.pending_registers.length > 5 && <li className="text-xs text-muted-foreground">+{summary.pending_registers.length - 5} more</li>}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{p && !p.school_day ? "No school today." : "Every class has taken its register."}</p>
              )}
            </li>
            <li className="px-4 py-3 sm:px-5">
              <p className="text-sm font-medium">Teachers away today</p>
              <p className="text-xs text-muted-foreground">{p ? (p.staff_absent + p.staff_on_leave > 0 ? `${p.staff_absent} absent, ${p.staff_on_leave} on leave` : "Everyone expected is in.") : "Unavailable"}</p>
            </li>
            <li className="px-4 py-3 sm:px-5">
              <p className="text-sm font-medium">Lessons from yesterday not marked</p>
              <p className="text-xs text-muted-foreground">{p ? (p.unmarked_yesterday > 0 ? `${p.unmarked_yesterday} lessons have no taught or not-taught mark` : "All marked.") : "Unavailable"}</p>
            </li>
          </ul>
        </Panel>
      </div>

      {/* Learning */}
      <Panel title="Learning this term" caption={term?.name ?? "No term set"} action={<Button variant="ghost" size="sm" className="h-9" nativeButton={false} render={<Link href="/dashboard/analytics">Analytics <ChevronRight /></Link>} />}>
        {!sc ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{term ? "Results have not been recorded for this term yet." : "Add an academic term to see learning figures."}</p>
        ) : (
          <div className="grid gap-px bg-border md:grid-cols-4">
            {[
              { label: "School average", value: sc.average.value !== null ? String(sc.average.value) : "—", sub: <Delta value={sc.average.value} previous={sc.average.previous} /> },
              { label: "Attendance rate", value: sc.attendance_rate.value !== null ? `${sc.attendance_rate.value}%` : "—", sub: <Delta value={sc.attendance_rate.value} previous={sc.attendance_rate.previous} unit=" pts" /> },
              { label: "Syllabus covered", value: sc.coverage.total ? `${Math.round((sc.coverage.completed / sc.coverage.total) * 100)}%` : "—", sub: <span className="text-xs text-muted-foreground">{sc.coverage.total ? `${sc.coverage.completed} of ${sc.coverage.total}${sc.coverage.expected !== null ? `, ${sc.coverage.expected} expected` : ""}` : "No plans yet"}</span> },
              { label: "Below expectation", value: sc.below_expectation !== null ? String(sc.below_expectation) : "—", sub: <Delta value={sc.below_expectation} previous={sc.below_expectation_previous} goodWhen="down" /> },
            ].map((m) => (
              <div key={m.label} className="bg-card p-4 sm:p-5">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="font-heading text-3xl font-semibold tabular-nums">{m.value}</p>
                <div>{m.sub}</div>
              </div>
            ))}
          </div>
        )}
        {attention && (attention.dropped_learners.length > 0 || attention.weak_subjects.length > 0 || attention.behind_teachers.length > 0 || attention.absence_streaks.length > 0) && (
          <div className="grid gap-4 border-t px-4 py-4 sm:px-5 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "Marks have fallen", items: attention.dropped_learners.slice(0, 3).map((d) => `${d.name}, ${d.class_name} (-${d.drop})`) },
              { title: "Absent 3+ days running", items: attention.absence_streaks.slice(0, 3).map((a) => `${a.name}, ${a.class_name} (${a.days} d)`) },
              { title: "Subjects needing support", items: attention.weak_subjects.slice(0, 3).map((w) => `${w.subject_name}, ${w.class_name} (${w.average})`) },
              { title: "Behind on syllabus", items: attention.behind_teachers.slice(0, 3).map((b) => `${b.teacher_name}: ${b.subject_name}, ${b.class_name} (${b.behind})`) },
            ].map((g) => (
              <div key={g.title}>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</p>
                {g.items.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">None</p> : <ul className="mt-1 flex flex-col gap-1">{g.items.map((t) => <li key={t} className="text-sm break-words">{t}</li>)}</ul>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Class by class */}
      {cards && cards.length > 0 && (
        <Panel title="Class by class" caption="Spot the class that is out of step" action={<Button variant="ghost" size="sm" className="h-9" nativeButton={false} render={<Link href="/dashboard/classes">All classes <ChevronRight /></Link>} />}>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] gap-3 border-b bg-muted/50 px-5 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
            <span>Class</span><span>Register today</span><span>Attendance</span><span>Average</span><span>Syllabus</span>
          </div>
          {LEVEL_ORDER.filter((l) => grouped[l]).map((l) => (
            <div key={l}>
              <p className="flex items-center gap-2 bg-muted/30 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5"><span className={`h-3 w-1 rounded-full ${LEVEL_BAR[l]}`} />{LEVEL_LABEL[l]}</p>
              <ul className="divide-y">
                {grouped[l].map((c) => {
                  const cov = c.topics_total ? Math.round((c.topics_covered / c.topics_total) * 100) : null;
                  return (
                    <li key={c.id}>
                      <Link href="/dashboard/classes" className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] md:items-center md:gap-y-0">
                        <span className="col-span-2 min-w-0 md:col-span-1"><span className="block font-medium break-words">{c.name}</span><span className="block text-xs text-muted-foreground">{c.homeroom_teacher_name ?? "No class teacher"} · {c.learners} learners</span></span>
                        <span>{c.register_today === "taken" ? <Pill tone="good">Taken</Pill> : c.register_today === "missing" ? <Pill tone="warn">Not taken</Pill> : <Pill tone="muted">No school</Pill>}</span>
                        <span className={`tabular-nums ${c.attendance_rate != null && c.attendance_rate < 90 ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`}><span className="text-xs text-muted-foreground md:hidden">Attendance </span>{c.attendance_rate != null ? `${c.attendance_rate}%` : "—"}</span>
                        <span className={`tabular-nums ${c.average != null && c.average < 50 ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`}><span className="text-xs text-muted-foreground md:hidden">Average </span>{c.average ?? "—"}</span>
                        <span className="tabular-nums"><span className="text-xs text-muted-foreground md:hidden">Syllabus </span>{cov !== null ? `${cov}%` : "No plan"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Panel>
      )}

      {/* Money and week */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="Fees" caption="Collected against billed" action={<Button variant="ghost" size="sm" className="h-9" nativeButton={false} render={<Link href="/dashboard/fees">Fees <ChevronRight /></Link>} />}>
          {summary ? (
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
              <div>
                <p className="font-heading text-3xl font-semibold tabular-nums">{summary.fee_collection_rate.toFixed(1)}%</p>
                <p className="mb-2 text-xs text-muted-foreground">KES {summary.amount_paid.toLocaleString()} of {summary.amount_billed.toLocaleString()} billed</p>
                <Meter value={summary.amount_paid} total={Math.max(summary.amount_billed, 1)} label="Fees collected" />
              </div>
              {summary.top_balances.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Largest balances</p>
                  <ul className="divide-y rounded-lg border">
                    {summary.top_balances.slice(0, 4).map((b) => (
                      <li key={b.student_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span className="min-w-0 break-words">{b.student_name}{b.class_name ? <span className="text-muted-foreground"> · {b.class_name}</span> : null}</span><span className="shrink-0 font-semibold tabular-nums">KES {b.balance.toLocaleString()}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Fee figures are unavailable.</p>
          )}
        </Panel>

        <Panel title="Attendance this week" caption="Share of learners present or late">
          <div className="px-2 py-4 sm:px-4">
            {trend.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No registers yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trend} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} fontSize={12} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)}%` : "Not marked", "Attendance"]} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>{trend.map((d) => <Cell key={d.date} fill={d.isToday ? "var(--primary)" : "#c4787a"} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {summary && summary.recent_activity.length > 0 && (
        <Panel title="Recent activity" caption="Across finance, academics and admissions">
          <ul className="divide-y">
            {summary.recent_activity.slice(0, 8).map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0 break-words"><span className="capitalize">{a.action}</span> {a.entity_type.replace(/_/g, " ")}{a.actor_name ? <span className="text-muted-foreground"> by {a.actor_name}</span> : null}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(a.created_at, now)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
