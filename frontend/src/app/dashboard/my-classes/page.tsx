"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, Clock, GraduationCap, Search, Users } from "lucide-react";
import { api, MyClass, MyTimetableSlot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SUBJECT_STYLES = [
  "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100",
  "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100",
  "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
  "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100",
  "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-100",
  "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-100",
];

function subjectStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_STYLES[hash % SUBJECT_STYLES.length];
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime24(t: string) {
  return t.slice(0, 5);
}

function WeeklyTimetable({ timetable }: { timetable: MyTimetableSlot[] }) {
  const todayIndex = (() => {
    const d = new Date().getDay();
    return d === 0 ? -1 : d - 1;
  })();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const rows = useMemo(() => {
    const seen = new Map<string, { start: string; end: string }>();
    for (const slot of timetable) {
      const key = `${slot.start_time}-${slot.end_time}`;
      if (!seen.has(key)) seen.set(key, { start: slot.start_time, end: slot.end_time });
    }
    return Array.from(seen.values()).sort((a, b) => a.start.localeCompare(b.start));
  }, [timetable]);

  function slotFor(day: number, start: string, end: string) {
    return timetable.find((s) => s.day_of_week === day && s.start_time === start && s.end_time === end);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4.5" /> My Timetable</CardTitle>
        <CardDescription>{timetable.length} lesson{timetable.length === 1 ? "" : "s"} this week, at a glance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-24 border-b border-r bg-muted/50 p-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <span className="flex items-center gap-1"><Clock className="size-3" /> Time</span>
                </th>
                {DAY_NAMES.map((day, i) => (
                  <th
                    key={day}
                    className={`min-w-36 border-b p-2.5 text-left text-xs font-semibold tracking-wide uppercase ${
                      i === todayIndex ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {DAYS[i]}
                    {i === todayIndex && <span className="ml-1 font-normal normal-case opacity-70">· today</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isNowRow = todayIndex >= 0 && timeToMinutes(row.start) <= nowMinutes && nowMinutes < timeToMinutes(row.end);
                return (
                  <tr key={`${row.start}-${row.end}`} className={ri % 2 === 1 ? "bg-muted/20" : ""}>
                    <td className="sticky left-0 z-10 border-r bg-background p-2.5 align-top text-xs text-muted-foreground tabular-nums">
                      <div className="flex flex-col">
                        <span>{formatTime24(row.start)}</span>
                        <span>{formatTime24(row.end)}</span>
                      </div>
                    </td>
                    {DAY_NAMES.map((_, di) => {
                      const slot = slotFor(di, row.start, row.end);
                      const isNow = isNowRow && di === todayIndex;
                      return (
                        <td key={di} className={`p-1.5 align-top ${di === todayIndex ? "bg-primary/5" : ""}`}>
                          {slot ? (
                            <div className={`rounded-lg border p-2 ${subjectStyle(slot.subject_name)} ${isNow ? "ring-2 ring-primary" : ""}`}>
                              <p className="truncate text-xs font-semibold">{slot.subject_name}</p>
                              <p className="truncate text-[0.7rem] opacity-80">{slot.class_name}{slot.room ? ` · ${slot.room}` : ""}</p>
                            </div>
                          ) : (
                            <div className="h-full min-h-10" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ClassCard({ c }: { c: MyClass }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {c.is_homeroom_teacher ? <GraduationCap className="size-4.5" /> : <BookOpen className="size-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-heading text-sm font-semibold">{c.class_name}</p>
            {c.is_homeroom_teacher && <Badge className="gap-1 shrink-0"><GraduationCap className="size-3" /> Class teacher</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {c.subjects.length > 0 ? c.subjects.map((s) => s.subject_name).join(", ") : "Homeroom"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {c.can_mark_attendance && (
            c.attendance_marked_today ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <ClipboardCheck className="size-4 text-amber-600" />
            )
          )}
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <CardContent className="flex flex-col gap-3 border-t pt-3 pb-4">
          {c.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.subjects.map((s) => <Badge key={s.subject_id} variant="secondary">{s.subject_name}</Badge>)}
            </div>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {c.student_count} learners</span>
            {c.can_mark_attendance && (
              <span className="flex items-center gap-1.5">
                {c.attendance_marked_today ? (
                  <><CheckCircle2 className="size-3.5 text-emerald-600" /> Register marked</>
                ) : (
                  <><ClipboardCheck className="size-3.5 text-amber-600" /> Register pending</>
                )}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {c.can_mark_attendance && (
              <Link href={`/dashboard/attendance?class_id=${c.class_id}`}>
                <Button size="sm" variant="outline"><ClipboardCheck /> Attendance</Button>
              </Link>
            )}
            <Link href="/dashboard/results">
              <Button size="sm" variant="outline">Results</Button>
            </Link>
            <Link href={`/dashboard/students?class_id=${c.class_id}`}>
              <Button size="sm" variant="ghost">Roster</Button>
            </Link>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function MyClassesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [timetable, setTimetable] = useState<MyTimetableSlot[]>([]);
  const [search, setSearch] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && user.role !== "teacher") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listMyClasses(token, user.school_id).then(setClasses).catch(() => setClasses([])),
      api.listMyTimetable(token, user.school_id).then(setTimetable).catch(() => setTimetable([])),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  const homeroomCount = classes.filter((c) => c.is_homeroom_teacher).length;

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? classes.filter(
          (c) => c.class_name.toLowerCase().includes(q) || c.subjects.some((s) => s.subject_name.toLowerCase().includes(q))
        )
      : classes;
    return [...filtered].sort((a, b) => {
      if (a.is_homeroom_teacher !== b.is_homeroom_teacher) return a.is_homeroom_teacher ? -1 : 1;
      return a.class_name.localeCompare(b.class_name);
    });
  }, [classes, search]);

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Classes"
        description={
          classes.length === 0
            ? "You haven't been assigned to any classes yet — ask your school admin to set this up."
            : `${classes.length} class${classes.length > 1 ? "es" : ""}${homeroomCount ? ` · class teacher for ${homeroomCount}` : ""}`
        }
      />

      {classes.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by class or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c) => (
          <ClassCard key={c.class_id} c={c} />
        ))}
      </div>

      {classes.length === 0 && !dataLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <GraduationCap className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No classes assigned to you yet.</p>
          </CardContent>
        </Card>
      )}

      {classes.length > 0 && sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No classes match your search.</p>
      )}

      {timetable.length > 0 && <WeeklyTimetable timetable={timetable} />}
    </div>
  );
}
