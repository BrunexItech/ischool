"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarCheck, Check, ChevronDown, ChevronLeft, ChevronRight, History, RotateCw, Save, Search } from "lucide-react";
import { api, ApiError, AttendanceOversight, AttendanceRecord, AttendanceStatus, Student } from "@/lib/api";
import { ErrorBox, LEVEL_BAR, LEVEL_LABEL, PageHead, Pill } from "@/components/oversight";
import { useAuth } from "@/lib/auth";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "late", "absent", "excused"];
const SHORT: Record<AttendanceStatus, string> = { present: "P", late: "L", absent: "A", excused: "E" };
const FULL: Record<AttendanceStatus, string> = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" };

const ACTIVE: Record<AttendanceStatus, string> = {
  present: "border-emerald-600 bg-emerald-600 text-white",
  late: "border-amber-500 bg-amber-500 text-white",
  absent: "border-red-600 bg-red-600 text-white",
  excused: "border-sky-600 bg-sky-600 text-white",
};
const BAR: Record<AttendanceStatus, string> = { present: "bg-emerald-500", late: "bg-amber-400", excused: "bg-sky-500", absent: "bg-red-500" };
const TEXT: Record<AttendanceStatus, string> = {
  present: "text-emerald-700 dark:text-emerald-400",
  late: "text-amber-700 dark:text-amber-400",
  absent: "text-red-700 dark:text-red-400",
  excused: "text-sky-700 dark:text-sky-400",
};

const NEEDS_REASON: AttendanceStatus[] = ["absent", "late", "excused"];

interface ClassOption {
  id: number;
  name: string;
}

const AVATAR_TONES = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function StatusPicker({ value, disabled, onChange, name }: { value: AttendanceStatus; disabled: boolean; onChange: (s: AttendanceStatus) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={`Attendance for ${name}`} className="grid grid-cols-4 gap-1 sm:flex">
      {STATUS_OPTIONS.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={FULL[opt]}
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`flex h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:h-9 sm:min-w-[4.5rem] sm:px-3 ${active ? ACTIVE[opt] : "bg-background hover:bg-accent"}`}
          >
            <span className="sm:hidden">{SHORT[opt]}</span>
            <span className="hidden sm:inline">{FULL[opt]}</span>
          </button>
        );
      })}
    </div>
  );
}

function HistorySection({ schoolId, classes }: { schoolId: number; classes: ClassOption[] }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ from: addDaysStr(localDateStr(), -30), to: localDateStr(), classId: "__all__" });
  const [applied, setApplied] = useState(form);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<{ key: string; records: AttendanceRecord[] | null } | null>(null);
  const key = `${applied.from}/${applied.to}/${applied.classId}/${reloadKey}`;

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    api
      .listAttendanceHistory(token, schoolId, applied.from, applied.to, applied.classId === "__all__" ? undefined : Number(applied.classId))
      .then((records) => !cancelled && setData({ key, records }))
      .catch(() => !cancelled && setData({ key, records: null }));
    return () => {
      cancelled = true;
    };
  }, [open, token, schoolId, applied, key]);

  const loaded = data && data.key === key;
  const byDate = useMemo(() => {
    const records = loaded ? data.records : null;
    if (!records) return [];
    const map = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
    for (const r of records) {
      const row = map.get(r.date) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      row[r.status] += 1;
      row.total += 1;
      map.set(r.date, row);
    }
    return Array.from(map.entries())
      .map(([date, c]) => ({ date, ...c, rate: c.total ? Math.round(((c.total - c.absent) / c.total) * 1000) / 10 : 0 }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [loaded, data]);

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="attendance-history"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><History className="size-4.5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base font-semibold">Attendance history</span>
          <span className="block text-sm text-muted-foreground">Look back at any date range.</span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div id="attendance-history" className="flex flex-col gap-4 border-t p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,12rem))_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label>From</Label>
              <Input type="date" value={form.from} max={form.to} onChange={(e) => e.target.value && setForm((f) => ({ ...f, from: e.target.value }))} className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <Input type="date" value={form.to} min={form.from} onChange={(e) => e.target.value && setForm((f) => ({ ...f, to: e.target.value }))} className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Every class</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="h-10" onClick={() => setApplied(form)}><Search /> Search</Button>
          </div>

          {!loaded ? (
            <div className="py-8"><PageLoader /></div>
          ) : data.records === null ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="size-6 text-red-600" />
              <p className="text-sm text-muted-foreground">We couldn&apos;t load the history.</p>
              <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
            </div>
          ) : byDate.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No attendance recorded in this range.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 md:hidden">
                {byDate.map((row) => (
                  <li key={row.date} className="rounded-lg border p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium">{formatDate(row.date)}</p>
                      <p className="text-sm font-semibold tabular-nums">{row.rate}%</p>
                    </div>
                    <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      {(["present", "late", "excused", "absent"] as const).map((s) => row[s] > 0 && <span key={s} className={BAR[s]} style={{ width: `${(row[s] / row.total) * 100}%` }} />)}
                    </div>
                    <p className="mt-2 flex flex-wrap gap-x-3 text-xs">
                      {(["present", "late", "excused", "absent"] as const).map((s) => <span key={s} className={TEXT[s]}>{FULL[s]} {row[s]}</span>)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Date</th>
                      {(["present", "late", "excused", "absent"] as const).map((s) => <th key={s} className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide uppercase">{FULL[s]}</th>)}
                      <th className="w-40 px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Spread</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide uppercase">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDate.map((row) => (
                      <tr key={row.date} className="border-t">
                        <td className="px-3 py-2.5 font-medium whitespace-nowrap">{formatDate(row.date)}</td>
                        {(["present", "late", "excused", "absent"] as const).map((s) => <td key={s} className={`px-3 py-2.5 text-right tabular-nums ${TEXT[s]}`}>{row[s]}</td>)}
                        <td className="px-3 py-2.5">
                          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                            {(["present", "late", "excused", "absent"] as const).map((s) => row[s] > 0 && <span key={s} className={BAR[s]} style={{ width: `${(row[s] / row.total) * 100}%` }} />)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

interface Register {
  key: string;
  students: Student[];
  statuses: Record<number, AttendanceStatus>;
  reasons: Record<number, string>;
  hasRecords: boolean;
  failed: boolean;
}

function AttendanceView() {
  const { user, token, loading } = useAuth();
  const searchParams = useSearchParams();
  const schoolId = user?.school_id ?? null;
  const preselect = searchParams.get("class_id");
  const canMark = user?.role === "super_admin" || user?.role === "teacher" || user?.role === "staff";
  const isTeacher = user?.role === "teacher";

  const [classes, setClasses] = useState<ClassOption[] | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(localDateStr());
  const [reg, setReg] = useState<Register | null>(null);
  const [edits, setEdits] = useState<{ key: string; statuses: Record<number, AttendanceStatus>; reasons: Record<number, string> } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AttendanceStatus>("all");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    const load = isTeacher
      ? api.listMyClasses(token, schoolId).then((mine) => mine.filter((c) => c.can_mark_attendance).map((c) => ({ id: c.class_id, name: c.class_name })))
      : api.listClasses(token, schoolId).then((all) => all.map((c) => ({ id: c.id, name: c.name })));
    load
      .catch(() => [] as ClassOption[])
      .then((list) => {
        if (cancelled) return;
        setClasses(list);
        const pre = preselect ? list.find((c) => c.id === Number(preselect)) : undefined;
        setClassId((cur) => cur ?? pre?.id ?? list[0]?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, preselect]);

  const regKey = `${classId}/${date}/${reloadKey}`;
  useEffect(() => {
    if (!token || !schoolId || classId === null) return;
    let cancelled = false;
    Promise.all([
      api.listStudents(token, schoolId, classId).then((s) => ({ ok: true, s })).catch(() => ({ ok: false, s: [] as Student[] })),
      api.listAttendance(token, schoolId, classId, date).catch(() => [] as AttendanceRecord[]),
    ]).then(([st, records]) => {
      if (cancelled) return;
      const statuses: Record<number, AttendanceStatus> = {};
      const reasons: Record<number, string> = {};
      for (const r of records) {
        statuses[r.student_id] = r.status;
        if (r.reason) reasons[r.student_id] = r.reason;
      }
      setReg({ key: regKey, students: st.s, statuses, reasons, hasRecords: records.length > 0, failed: !st.ok });
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, classId, date, regKey]);

  const ready = reg !== null && reg.key === regKey;
  const draft = edits && edits.key === regKey ? edits : null;
  const statuses = useMemo(() => draft?.statuses ?? reg?.statuses ?? {}, [draft, reg]);
  const reasons = useMemo(() => draft?.reasons ?? reg?.reasons ?? {}, [draft, reg]);
  const students = useMemo(() => [...(reg?.students ?? [])].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)), [reg]);
  const statusOf = (id: number): AttendanceStatus => statuses[id] ?? "present";

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0 };
    for (const s of students) c[statuses[s.id] ?? "present"] += 1;
    return c;
  }, [students, statuses]);
  const rate = students.length ? Math.round(((students.length - counts.absent) / students.length) * 1000) / 10 : null;

  function edit(next: { statuses?: Record<number, AttendanceStatus>; reasons?: Record<number, string> }) {
    setEdits({ key: regKey, statuses: next.statuses ?? statuses, reasons: next.reasons ?? reasons });
  }

  function setStatus(id: number, status: AttendanceStatus) {
    if (!canMark) return;
    const nextReasons = { ...reasons };
    if (!NEEDS_REASON.includes(status)) delete nextReasons[id];
    edit({ statuses: { ...statuses, [id]: status }, reasons: nextReasons });
  }

  function markAllPresent() {
    edit({ statuses: Object.fromEntries(students.map((s) => [s.id, "present" as AttendanceStatus])), reasons: {} });
  }

  async function handleSave() {
    if (!token || !schoolId || classId === null || !reg) return;
    setSaving(true);
    try {
      await api.markAttendance(token, schoolId, {
        class_id: classId,
        date,
        records: students.map((s) => {
          const status = statusOf(s.id);
          const reason = NEEDS_REASON.includes(status) ? reasons[s.id]?.trim() : undefined;
          return { student_id: s.id, status, reason: reason || undefined };
        }),
      });
      setReg({ ...reg, statuses: Object.fromEntries(students.map((s) => [s.id, statusOf(s.id)])), reasons: { ...reasons }, hasRecords: true });
      setEdits(null);
      toast.success("Attendance saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  if (loading || classes === null) return <PageLoader />;

  const className = classes.find((c) => c.id === classId)?.name ?? "";
  const q = search.trim().toLowerCase();
  const visible = students
    .map((s, i) => ({ s, no: i + 1 }))
    .filter(({ s }) => (filter === "all" || statusOf(s.id) === filter) && (!q || `${s.first_name} ${s.last_name} ${s.admission_number}`.toLowerCase().includes(q)));
  const isToday = date === localDateStr();
  const dirty = draft !== null;
  const needsSave = canMark && ready && students.length > 0 && (dirty || !reg.hasRecords);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#6e1316] px-5 py-4 text-primary-foreground shadow-sm sm:px-6 sm:py-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-sidebar-primary" aria-hidden />
        <div className="relative flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 sm:size-14"><CalendarCheck className="size-6 sm:size-7" /></span>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Attendance</h1>
            <p className="text-sm text-primary-foreground/80">{canMark ? "Take the daily register for your class." : "The daily register, recorded by the class teacher."}</p>
          </div>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          {isTeacher ? "You are not the class teacher of any class, so there is no register for you to take." : "There are no classes yet."}
        </div>
      ) : (
        <>
          <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end sm:gap-4 sm:p-5">
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
                <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <div className="flex items-center gap-1.5">
                <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" aria-label="Previous day" onClick={() => setDate((d) => addDaysStr(d, -1))}><ChevronLeft /></Button>
                <Input type="date" value={date} max={localDateStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 min-w-0 flex-1 sm:w-44 sm:flex-none" />
                <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" aria-label="Next day" disabled={isToday} onClick={() => setDate((d) => addDaysStr(d, 1))}><ChevronRight /></Button>
                {!isToday && <Button type="button" variant="ghost" className="h-10" onClick={() => setDate(localDateStr())}>Today</Button>}
              </div>
            </div>
          </section>

          {!ready ? (
            <PageLoader />
          ) : reg.failed ? (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
              <AlertTriangle className="size-6 text-red-600" />
              <p className="text-sm text-muted-foreground">We couldn&apos;t load this class.</p>
              <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
            </div>
          ) : (
            <>
              <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Summary">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-semibold break-words">{className} register</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(date)} · {students.length} learner{students.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${reg.hasRecords && !dirty ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                    {reg.hasRecords && !dirty ? <><Check className="size-3.5" /> Saved</> : dirty ? "Unsaved changes" : "Not taken yet"}
                  </span>
                </div>
                {students.length > 0 && (
                  <>
                    <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${counts.present} present, ${counts.late} late, ${counts.excused} excused, ${counts.absent} absent`}>
                      {STATUS_OPTIONS.map((s) => counts[s] > 0 && <span key={s} className={BAR[s]} style={{ width: `${(counts[s] / students.length) * 100}%` }} />)}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
                      {STATUS_OPTIONS.map((s) => (
                        <div key={s}>
                          <dt className="text-xs text-muted-foreground">{FULL[s]}</dt>
                          <dd className={`font-heading text-xl font-semibold tabular-nums ${TEXT[s]}`}>{counts[s]}</dd>
                        </div>
                      ))}
                      <div>
                        <dt className="text-xs text-muted-foreground">Attendance rate</dt>
                        <dd className="font-heading text-xl font-semibold tabular-nums">{rate}%</dd>
                      </div>
                    </dl>
                  </>
                )}
              </section>

              <section className="overflow-hidden rounded-xl border bg-card">
                <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {canMark ? "Everyone starts as present. Tap only the exceptions: P present, L late, A absent, E excused." : "Read-only. Marked by the class teacher."}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 sm:w-60 sm:flex-none">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search learners..." aria-label="Search learners" className="h-10 pl-8 sm:h-9" />
                      </div>
                      {canMark && students.length > 0 && <Button variant="outline" className="h-10 shrink-0 sm:h-9" onClick={markAllPresent}>All present</Button>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["all", ...STATUS_OPTIONS] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={filter === f}
                        onClick={() => setFilter(f)}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                      >
                        {f === "all" ? "Everyone" : FULL[f]}
                        <span className={`rounded-full px-1.5 text-xs tabular-nums ${filter === f ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>{f === "all" ? students.length : counts[f]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {students.length === 0 ? (
                  <p className="px-4 py-12 text-center text-sm text-muted-foreground">No learners in this class yet.</p>
                ) : visible.length === 0 ? (
                  <p className="px-4 py-12 text-center text-sm text-muted-foreground">No learners match.</p>
                ) : (
                  <ul className="divide-y">
                    {visible.map(({ s, no }) => {
                      const status = statusOf(s.id);
                      const fullName = `${s.first_name} ${s.last_name}`;
                      return (
                        <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:gap-5">
                          <div className="flex min-w-0 items-center gap-3 lg:w-72 lg:shrink-0">
                            <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{String(no).padStart(2, "0")}</span>
                            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${AVATAR_TONES[s.id % AVATAR_TONES.length]}`} aria-hidden>
                              {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium break-words">{fullName}</span>
                              <span className="block text-xs text-muted-foreground">Adm. {s.admission_number}</span>
                            </span>
                          </div>
                          <div className="lg:flex-1">
                            <StatusPicker value={status} disabled={!canMark} name={fullName} onChange={(v) => setStatus(s.id, v)} />
                          </div>
                          {NEEDS_REASON.includes(status) && (
                            <div className="lg:w-64 lg:shrink-0">
                              {canMark ? (
                                <Input value={reasons[s.id] ?? ""} onChange={(e) => edit({ reasons: { ...reasons, [s.id]: e.target.value } })} placeholder="Reason, e.g. sick" aria-label={`Reason for ${fullName}`} className="h-10" />
                              ) : (
                                <span className="text-sm text-muted-foreground">{reasons[s.id] || "No reason given"}</span>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {needsSave && (
                <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:justify-end">
                  <p className="text-sm text-muted-foreground sm:mr-2">{dirty ? "You have unsaved changes." : "This register has not been saved."}</p>
                  <Button onClick={handleSave} disabled={saving} className="h-11 sm:h-9">
                    {saving ? <Spinner size={16} className="text-current" /> : <Save />} {saving ? "Saving..." : "Save attendance"}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {schoolId && <HistorySection schoolId={schoolId} classes={classes} />}
    </div>
  );
}

function AttendanceOversightView() {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [date, setDate] = useState(localDateStr());
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<{ key: string; value: AttendanceOversight | null } | null>(null);
  const [filter, setFilter] = useState<"all" | "missing" | "absent">("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const key = `${date}/${reloadKey}`;

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.getAttendanceOversight(token, schoolId, date).then((value) => !cancelled && setData({ key, value })).catch(() => !cancelled && setData({ key, value: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, date, key]);

  const ready = data && data.key === key;
  const v = ready ? data.value : null;
  const isToday = date === localDateStr();
  const q = search.trim().toLowerCase();
  const rows = (v?.rows ?? []).filter((r) => (filter === "all" || (filter === "missing" ? r.register_status === "missing" : r.absent + r.late + r.excused > 0)) && (!q || r.class_name.toLowerCase().includes(q)));
  const levels = ["pre_primary", "primary", "junior_school", "senior_school", "other"];
  const groups = levels.map((l) => ({ level: l, items: rows.filter((r) => r.level === l) })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Attendance" subtitle="Which registers have been taken, by whom, and who is away. Class teachers take the registers; you see them here." />

      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Previous day" onClick={() => setDate((d) => addDaysStr(d, -1))}><ChevronLeft /></Button>
        <Input type="date" value={date} max={localDateStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 w-44" />
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Next day" disabled={isToday} onClick={() => setDate((d) => addDaysStr(d, 1))}><ChevronRight /></Button>
        {!isToday && <Button type="button" variant="ghost" className="h-10" onClick={() => setDate(localDateStr())}>Today</Button>}
        <span className="ml-1 text-sm text-muted-foreground">{formatDate(date)}</span>
      </div>

      {!ready ? (
        <PageLoader />
      ) : !v ? (
        <ErrorBox message="We couldn't load the attendance." onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !v.school_day && v.classes_taken === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">{v.holiday ? `${v.holiday} is a holiday on the school calendar.` : "This is not a school day."}</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
            {[
              ["Registers taken", `${v.classes_taken} of ${v.classes_total}`, v.classes_taken === v.classes_total ? "Every class" : `${v.classes_total - v.classes_taken} still to take`],
              ["Attendance rate", v.school_rate != null ? `${v.school_rate}%` : "—", "across registers taken"],
              ["Learners marked", String(v.learners_marked), "in registers so far"],
              ["Away or late", String(v.rows.reduce((n, r) => n + r.absent + r.late + r.excused, 0)), "absent, late or excused"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border bg-card p-3.5 sm:p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a class..." aria-label="Search classes" className="h-10 pl-8" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
              {([["all", "All classes"], ["missing", "Register not taken"], ["absent", "With absentees"]] as const).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${filter === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{label}</button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No classes match.</p>
          ) : (
            groups.map((g) => (
              <section key={g.level} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className={`h-5 w-1.5 rounded-full ${LEVEL_BAR[g.level]}`} aria-hidden />
                  <h2 className="font-heading text-lg font-semibold">{LEVEL_LABEL[g.level]}</h2>
                </div>
                <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                  {g.items.map((r) => {
                    const isOpen = open.has(r.class_id);
                    const hasList = r.absentees.length > 0;
                    return (
                      <li key={r.class_id}>
                        <button type="button" disabled={!hasList} aria-expanded={isOpen} onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(r.class_id)) n.delete(r.class_id); else n.add(r.class_id); return n; })} className="grid w-full gap-x-4 gap-y-2 px-4 py-3 text-left outline-none transition-colors enabled:hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_9rem_minmax(0,1fr)_minmax(0,1.2fr)_1.5rem] lg:items-center">
                          <span className="min-w-0"><span className="block font-medium break-words">{r.class_name}</span><span className="block text-xs text-muted-foreground">{r.learners} learners</span></span>
                          <span>{r.register_status === "taken" ? <Pill tone="good">Register taken</Pill> : r.register_status === "missing" ? <Pill tone="warn">Not taken</Pill> : <Pill tone="muted">No school</Pill>}</span>
                          <span className="text-xs text-muted-foreground">{r.register_status === "taken" ? `by ${r.taken_by ?? "a teacher"}` : "No register yet"}</span>
                          {r.register_status === "taken" ? (
                            <span>
                              <span className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                                {r.present > 0 && <span className="bg-emerald-500" style={{ width: `${(r.present / Math.max(1, r.present + r.late + r.excused + r.absent)) * 100}%` }} />}
                                {r.late > 0 && <span className="bg-amber-400" style={{ width: `${(r.late / Math.max(1, r.present + r.late + r.excused + r.absent)) * 100}%` }} />}
                                {r.excused > 0 && <span className="bg-sky-500" style={{ width: `${(r.excused / Math.max(1, r.present + r.late + r.excused + r.absent)) * 100}%` }} />}
                                {r.absent > 0 && <span className="bg-red-500" style={{ width: `${(r.absent / Math.max(1, r.present + r.late + r.excused + r.absent)) * 100}%` }} />}
                              </span>
                              <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums">{r.present} present · {r.late} late · {r.excused} excused · {r.absent} absent · <strong className="text-foreground">{r.rate}%</strong></span>
                            </span>
                          ) : <span />}
                          <ChevronDown className={`hidden size-4 text-muted-foreground transition-transform lg:block ${isOpen ? "rotate-180" : ""} ${hasList ? "" : "opacity-0"}`} aria-hidden />
                        </button>
                        {isOpen && hasList && (
                          <ul className="divide-y border-t bg-muted/20">
                            {r.absentees.map((a, i) => (
                              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm sm:px-5 lg:pl-8">
                                <span className="min-w-0 break-words">{a.name}{a.reason ? <span className="text-muted-foreground"> · {a.reason}</span> : null}</span>
                                <Pill tone={a.status === "absent" ? "bad" : a.status === "late" ? "warn" : "info"}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</Pill>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      {schoolId && v && <HistorySection schoolId={schoolId} classes={v.rows.map((r) => ({ id: r.class_id, name: r.class_name }))} />}
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const isLeadership = user?.role === "head_of_institution" || user?.role === "group_principal";
  return (
    <Suspense fallback={<PageLoader />}>
      {isLeadership ? <AttendanceOversightView /> : <AttendanceView />}
    </Suspense>
  );
}
