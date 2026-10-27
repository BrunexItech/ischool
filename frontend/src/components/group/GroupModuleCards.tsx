"use client";

import { AlertTriangle, BookMarked, BookOpen, Boxes, Bus, ClipboardCheck, ClipboardList, GraduationCap, NotebookPen, Users, Users2, UserCheck, Wallet, Wallet2, Award } from "lucide-react";
import { GroupColumn, GroupRow } from "@/lib/api";
import { Bar, compactKes, healthTone, kes, Ring, StackBar } from "@/components/group/GroupUi";

type V = Record<string, number | null>;
export interface CardProps {
  row: GroupRow;
  color: string;
  group: V;
  columns: GroupColumn[];
}

export const MODULE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  classes: BookOpen, teachers: GraduationCap, students: Users, attendance: ClipboardCheck, staff: UserCheck, lessons: NotebookPen, homework: ClipboardList,
  results: Award, conduct: AlertTriangle, fees: Wallet, finance: Wallet2, transport: Bus, library: BookMarked, stores: Boxes, admissions: Users2,
};

/** Which figure ranks the schools on each page, and which way is better. Modules with no single fair measure are not ranked. */
export const PRIMARY: Record<string, { key: string; better: "high" | "low"; label: string }> = {
  attendance: { key: "rate_today", better: "high", label: "in school today" },
  results: { key: "average", better: "high", label: "school average" },
  fees: { key: "rate", better: "high", label: "fees collected" },
  lessons: { key: "coverage_pct", better: "high", label: "syllabus covered" },
  homework: { key: "recorded_pct", better: "high", label: "homework recorded" },
  teachers: { key: "lessons_marked_pct", better: "high", label: "lessons marked" },
  finance: { key: "net_month", better: "high", label: "left over this month" },
  library: { key: "overdue", better: "low", label: "overdue books" },
  conduct: { key: "open_reports", better: "low", label: "open reports" },
};

const n = (x: number | null | undefined) => (x == null ? "—" : Math.round(x).toLocaleString());

function Chip({ tone = "muted", children }: { tone?: "muted" | "warn" | "bad" | "good" | "info"; children: React.ReactNode }) {
  const map = {
    muted: "bg-muted text-muted-foreground",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    bad: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

function Big({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className={`font-heading text-4xl leading-none font-semibold tabular-nums ${tone ?? ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string; value: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden /><span className="text-muted-foreground">{i.label}</span><span className="font-semibold tabular-nums">{i.value}</span></li>
      ))}
    </ul>
  );
}

/** A row of small dots: one per teacher, coloured by whether they are in. */
function Dots({ total, good, bad, label }: { total: number; good: number; bad: number; label: string }) {
  const cap = 48;
  const scale = total > cap ? cap / total : 1;
  const shown = Math.max(1, Math.round(total * scale));
  const g = Math.round(good * scale);
  const b = Math.round(bad * scale);
  return (
    <span className="flex flex-wrap gap-1" role="img" aria-label={label}>
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className={`size-3 rounded-full ${i < g ? "bg-emerald-500" : i < g + b ? "bg-red-500" : "bg-muted-foreground/25"}`} />
      ))}
    </span>
  );
}

const off = <p className="text-sm text-muted-foreground">This school is not using this part of the system.</p>;

export const CARDS: Record<string, (p: CardProps) => React.ReactNode> = {
  classes: ({ row, color, group }) => {
    const v = row.values as V;
    const share = group.learners ? Math.round(((v.learners ?? 0) / group.learners) * 100) : 0;
    const size = v.avg_size ?? 0;
    const tone = size <= 35 ? "#059669" : size <= 45 ? "#D97706" : "#DC2626";
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3"><Big value={n(v.classes)} label="classes" /><Big value={n(v.learners)} label="learners" /></div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Share of all learners</span><span className="font-semibold tabular-nums">{share}%</span></div>
          <span className="block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full transition-all duration-700" style={{ width: `${share}%`, background: color }} /></span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Average class size</span><span className="font-semibold tabular-nums" style={{ color: tone }}>{size || "—"}</span></div>
          <span className="relative block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (size / 60) * 100)}%`, background: tone }} /></span>
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>comfortable up to 35</span><span>60</span></div>
        </div>
        {(v.no_class_teacher ?? 0) > 0 ? <Chip tone="warn">{v.no_class_teacher} class{v.no_class_teacher === 1 ? "" : "es"} without a class teacher</Chip> : <Chip tone="good">Every class has a class teacher</Chip>}
      </div>
    );
  },

  teachers: ({ row }) => {
    const v = row.values as V;
    const tone = healthTone(v.lessons_marked_pct);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Big value={n(v.teachers)} label="teachers" />
          <Ring value={v.lessons_marked_pct} size={84} stroke={8} label="Lessons marked this week"><span className={`text-lg font-semibold tabular-nums ${tone.text}`}>{v.lessons_marked_pct != null ? `${v.lessons_marked_pct}%` : "—"}</span><span className="mt-0.5 text-[9px] text-muted-foreground">lessons marked</span></Ring>
        </div>
        {v.in_today != null ? (
          <div className="flex flex-col gap-2"><Dots total={v.teachers ?? 0} good={v.in_today ?? 0} bad={v.absent_today ?? 0} label={`${v.in_today} in, ${v.absent_today} absent`} /><Legend items={[{ color: "#10B981", label: "in today", value: n(v.in_today) }, { color: "#EF4444", label: "absent", value: n(v.absent_today) }]} /></div>
        ) : <p className="text-sm text-muted-foreground">No school today, so nobody is expected.</p>}
        <p className="text-xs text-muted-foreground">{n(v.class_teachers)} class teacher{v.class_teachers === 1 ? "" : "s"} appointed</p>
      </div>
    );
  },

  students: ({ row, color }) => {
    const v = row.values as V;
    return (
      <div className="flex flex-col gap-4">
        <Big value={n(v.learners)} label="learners" />
        <div className="flex flex-col gap-1.5">
          <StackBar label="Boys and girls" parts={[{ value: v.boys ?? 0, color, label: "boys" }, { value: v.girls ?? 0, color: "#FFA819", label: "girls" }]} height={12} />
          <Legend items={[{ color, label: "boys", value: n(v.boys) }, { color: "#FFA819", label: "girls", value: n(v.girls) }]} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="info">{n(v.new_this_term)} new this term</Chip>
          {(v.exam_numbers_missing ?? 0) > 0 && <Chip tone="warn">{v.exam_numbers_missing} exam numbers missing</Chip>}
          {(v.no_guardian_phone ?? 0) > 0 && <Chip tone="warn">{v.no_guardian_phone} with no guardian phone</Chip>}
        </div>
      </div>
    );
  },

  attendance: ({ row }) => {
    const v = row.values as V;
    const t = healthTone(v.rate_today);
    const w = healthTone(v.rate_week);
    return (
      <div className="flex items-center gap-5">
        <Ring value={v.rate_today} size={116} stroke={11} label="In school today">
          <span className={`font-heading text-2xl font-semibold tabular-nums ${t.text}`}>{v.rate_today != null ? `${v.rate_today}%` : "—"}</span>
          <span className="mt-1 text-[10px] text-muted-foreground">in school today</span>
        </Ring>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div><div className="flex justify-between text-xs"><span className="text-muted-foreground">This week</span><span className={`font-semibold tabular-nums ${w.text}`}>{v.rate_week != null ? `${v.rate_week}%` : "—"}</span></div><Bar value={v.rate_week} label="This week" /></div>
          <div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Registers taken</span><span className="font-semibold tabular-nums">{v.registers_total ? `${v.registers_taken} of ${v.registers_total}` : "—"}</span></div>
            <Bar value={v.registers_total ? Math.round(((v.registers_taken ?? 0) / v.registers_total) * 100) : null} label="Registers taken" />
          </div>
        </div>
      </div>
    );
  },

  staff: ({ row }) => {
    const v = row.values as V;
    const present = Math.max(0, (v.in_today ?? 0) - (v.late ?? 0));
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between"><Big value={v.in_today != null ? `${n(v.in_today)}/${n(v.tracked)}` : "—"} label="staff in today" /></div>
        {v.in_today != null ? (
          <div className="flex flex-col gap-2">
            <StackBar label="Staff today" height={14} parts={[{ value: present, color: "#10B981", label: "on time" }, { value: v.late ?? 0, color: "#F59E0B", label: "late" }, { value: v.absent ?? 0, color: "#EF4444", label: "absent" }, { value: v.on_leave ?? 0, color: "#94A3B8", label: "on leave" }]} />
            <Legend items={[{ color: "#10B981", label: "on time", value: n(present) }, { color: "#F59E0B", label: "late", value: n(v.late) }, { color: "#EF4444", label: "absent", value: n(v.absent) }, { color: "#94A3B8", label: "on leave", value: n(v.on_leave) }]} />
          </div>
        ) : <p className="text-sm text-muted-foreground">No school today.</p>}
      </div>
    );
  },

  lessons: ({ row }) => {
    const v = row.values as V;
    const t = healthTone(v.coverage_pct);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <Ring value={v.coverage_pct} size={104} stroke={10} label="Syllabus covered"><span className={`font-heading text-2xl font-semibold tabular-nums ${t.text}`}>{v.coverage_pct != null ? `${v.coverage_pct}%` : "—"}</span><span className="mt-0.5 text-[10px] text-muted-foreground">syllabus covered</span></Ring>
          <div className="min-w-0 flex-1 text-sm"><p className="font-semibold tabular-nums">{n(v.topics_covered)} <span className="font-normal text-muted-foreground">of {n(v.topics_total)} topics</span></p><div className="mt-2"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Lessons marked this week</span><span className="font-semibold tabular-nums">{v.lessons_marked_pct != null ? `${v.lessons_marked_pct}%` : "—"}</span></div><Bar value={v.lessons_marked_pct} label="Lessons marked" /></div></div>
        </div>
        {(v.classes_without_plan ?? 0) > 0 ? <Chip tone="warn">{v.classes_without_plan} class{v.classes_without_plan === 1 ? "" : "es"} with no lesson plan</Chip> : <Chip tone="good">Every class has a plan</Chip>}
      </div>
    );
  },

  homework: ({ row }) => {
    const v = row.values as V;
    const t = healthTone(v.recorded_pct);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <Ring value={v.recorded_pct} size={96} stroke={10} label="Homework recorded"><span className={`font-heading text-2xl font-semibold tabular-nums ${t.text}`}>{v.recorded_pct != null ? `${v.recorded_pct}%` : "—"}</span><span className="mt-0.5 text-[10px] text-muted-foreground">recorded</span></Ring>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <StackBar label="Homework this week" height={12} parts={[{ value: v.set_homework ?? 0, color: "#10B981", label: "set" }, { value: v.none_set ?? 0, color: "#94A3B8", label: "none today" }, { value: v.missing ?? 0, color: "#F59E0B", label: "nothing recorded" }]} />
            <Legend items={[{ color: "#10B981", label: "set", value: n(v.set_homework) }, { color: "#94A3B8", label: "no homework", value: n(v.none_set) }, { color: "#F59E0B", label: "nothing recorded", value: n(v.missing) }]} />
          </div>
        </div>
      </div>
    );
  },

  results: ({ row }) => {
    const v = row.values as V;
    const t = healthTone(v.average);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div><p className={`font-heading text-5xl leading-none font-semibold tabular-nums ${t.text}`}>{v.average ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">school average out of 100</p></div>
          <Ring value={v.pass_rate} size={84} stroke={8} label="Pass rate"><span className="text-lg font-semibold tabular-nums">{v.pass_rate != null ? `${v.pass_rate}%` : "—"}</span><span className="mt-0.5 text-[9px] text-muted-foreground">pass rate</span></Ring>
        </div>
        <Bar value={v.average} label="School average" />
        <div className="flex flex-wrap gap-1.5"><Chip tone="info">{n(v.learners_marked)} learners marked</Chip>{(v.weak_classes ?? 0) > 0 ? <Chip tone="bad">{v.weak_classes} class{v.weak_classes === 1 ? "" : "es"} under 50</Chip> : <Chip tone="good">No class under 50</Chip>}</div>
      </div>
    );
  },

  conduct: ({ row }) => {
    const v = row.values as V;
    const open = v.open_reports ?? 0;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3"><Big value={n(open)} label="reports waiting for the head" tone={open > 5 ? "text-red-700 dark:text-red-400" : open > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"} /></div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Filed this week</span><span className="font-semibold tabular-nums">{n(v.this_week)}</span></div>
          <span className="block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${v.this_term ? Math.min(100, ((v.this_week ?? 0) / v.this_term) * 100) : 0}%` }} /></span>
          <p className="text-[11px] text-muted-foreground">{n(v.this_term)} reports in all</p>
        </div>
      </div>
    );
  },

  fees: ({ row, color }) => {
    const v = row.values as V;
    const t = healthTone(v.rate);
    const pct = v.billed ? Math.min(100, ((v.collected ?? 0) / v.billed) * 100) : 0;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3"><div><p className={`font-heading text-4xl leading-none font-semibold tabular-nums ${t.text}`}>{v.rate != null ? `${v.rate}%` : "—"}</p><p className="mt-1 text-xs text-muted-foreground">collected of what was billed</p></div><div className="text-right"><p className="font-heading text-lg font-semibold tabular-nums">{compactKes(v.outstanding ?? 0)}</p><p className="text-xs text-muted-foreground">still owed</p></div></div>
        <div className="flex flex-col gap-1.5">
          <span className="relative block h-5 overflow-hidden rounded-md border border-dashed bg-muted/40" role="img" aria-label={`Collected ${kes(v.collected ?? 0)} of ${kes(v.billed ?? 0)} billed`}>
            <span className="absolute inset-y-0 left-0 rounded-md transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
          </span>
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums"><span>{compactKes(v.collected ?? 0)} collected</span><span>{compactKes(v.billed ?? 0)} billed</span></div>
        </div>
        {(v.owing_learners ?? 0) > 0 ? <Chip tone={t.hex === "#DC2626" ? "bad" : "warn"}>{n(v.owing_learners)} learners owe fees</Chip> : <Chip tone="good">Nobody owes fees</Chip>}
      </div>
    );
  },

  finance: ({ row, group }) => {
    const v = row.values as V;
    const max = Math.max(1, ...[v.income_month ?? 0, v.expenses_month ?? 0]);
    const net = v.net_month ?? 0;
    void group;
    return (
      <div className="flex flex-col gap-4">
        <div><p className={`font-heading text-4xl leading-none font-semibold tabular-nums ${net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{net >= 0 ? "" : "−"}{compactKes(Math.abs(net))}</p><p className="mt-1 text-xs text-muted-foreground">{net >= 0 ? "left over" : "overspent"} this month</p></div>
        <div className="flex flex-col gap-2">
          <div><div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Fees received</span><span className="font-semibold tabular-nums">{compactKes(v.income_month ?? 0)}</span></div><span className="block h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${((v.income_month ?? 0) / max) * 100}%` }} /></span></div>
          <div><div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Spent</span><span className="font-semibold tabular-nums">{compactKes(v.expenses_month ?? 0)}</span></div><span className="block h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-rose-500 transition-all duration-700" style={{ width: `${((v.expenses_month ?? 0) / max) * 100}%` }} /></span></div>
        </div>
        {(v.pending_expenses ?? 0) > 0 ? <Chip tone="warn">{v.pending_expenses} expense{v.pending_expenses === 1 ? "" : "s"} awaiting approval</Chip> : <Chip tone="good">No expenses waiting</Chip>}
      </div>
    );
  },

  transport: ({ row }) => {
    const v = row.values as V;
    const done = v.runs_today ? Math.round(((v.runs_completed ?? 0) / v.runs_today) * 100) : null;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3"><Big value={n(v.vehicles)} label="vehicles on the road" /><Big value={n(v.riders)} label="learners ride" /></div>
        <div className="flex flex-col gap-1.5"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Runs completed today</span><span className="font-semibold tabular-nums">{v.runs_today ? `${v.runs_completed} of ${v.runs_today}` : "none yet"}</span></div><Bar value={done} label="Runs completed" /></div>
        {(v.fleet_alerts ?? 0) > 0 ? <Chip tone="bad">{v.fleet_alerts} vehicle paper{v.fleet_alerts === 1 ? "" : "s"} urgent</Chip> : <Chip tone="good">Vehicle papers are in order</Chip>}
      </div>
    );
  },

  library: ({ row, color }) => {
    const v = row.values as V;
    const loanPct = v.copies ? Math.round(((v.on_loan ?? 0) / v.copies) * 100) : null;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <Ring value={loanPct} size={92} stroke={9} color={color} label="Books out on loan"><span className="text-xl font-semibold tabular-nums">{n(v.on_loan)}</span><span className="mt-0.5 text-[10px] text-muted-foreground">out on loan</span></Ring>
          <div className="min-w-0 text-sm"><p className="font-semibold tabular-nums">{n(v.titles)} <span className="font-normal text-muted-foreground">titles</span></p><p className="font-semibold tabular-nums">{n(v.copies)} <span className="font-normal text-muted-foreground">copies</span></p></div>
        </div>
        <div className="flex flex-wrap gap-1.5">{(v.overdue ?? 0) > 0 ? <Chip tone="warn">{v.overdue} overdue</Chip> : <Chip tone="good">Nothing overdue</Chip>}{(v.lost ?? 0) > 0 && <Chip tone="bad">{v.lost} lost</Chip>}</div>
      </div>
    );
  },

  stores: ({ row }) => {
    const v = row.values as V;
    return (
      <div className="flex flex-col gap-4">
        <div><p className="font-heading text-4xl leading-none font-semibold tabular-nums">{compactKes(v.stock_value ?? 0)}</p><p className="mt-1 text-xs text-muted-foreground">of stock across {n(v.items)} items</p></div>
        <div className="flex flex-wrap gap-1.5">{(v.low_stock ?? 0) > 0 ? <Chip tone="warn">{v.low_stock} to reorder</Chip> : <Chip tone="good">Stock levels fine</Chip>}{(v.requests_waiting ?? 0) > 0 && <Chip tone="info">{v.requests_waiting} request{v.requests_waiting === 1 ? "" : "s"} waiting</Chip>}</div>
      </div>
    );
  },

  admissions: ({ row, color }) => {
    const v = row.values as V;
    const top = Math.max(1, v.open_enquiries ?? 0, v.applied ?? 0, v.enrolled ?? 0);
    const steps = [["Open enquiries", v.open_enquiries ?? 0, 1], ["Applied or offered", v.applied ?? 0, 0.78], ["Enrolled", v.enrolled ?? 0, 0.58]] as const;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-1.5" role="img" aria-label={steps.map(([l, c]) => `${c} ${l}`).join(", ")}>
          {steps.map(([label, count, base], i) => (
            <div key={label} className="flex w-full justify-center"><div className="flex h-8 items-center justify-between rounded-md px-3 text-xs font-medium text-white transition-all duration-700" style={{ width: `${Math.max(34, Math.round(base * 100 * (count / top) * 0.4 + base * 60))}%`, background: color, opacity: 1 - i * 0.22 }}><span className="truncate">{label}</span><span className="font-semibold tabular-nums">{count}</span></div></div>
          ))}
        </div>
        {(v.lost ?? 0) > 0 && <Chip tone="muted">{v.lost} lost along the way</Chip>}
      </div>
    );
  },
};

export const fallbackCard = ({ row, columns }: CardProps) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
    {columns.map((c) => (
      <div key={c.key}><dt className="text-xs text-muted-foreground">{c.label}</dt><dd className="text-base font-semibold tabular-nums">{n(row.values[c.key])}</dd></div>
    ))}
  </dl>
);

export const NotInUse = off;
