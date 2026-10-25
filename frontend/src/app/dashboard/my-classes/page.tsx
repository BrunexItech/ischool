"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Info,
  LayoutGrid,
  List,
  RotateCw,
  Search,
  Users,
} from "lucide-react";
import { api, AcademicTerm, GradeLevel, LessonPlan, LevelGroup, MyClass, MyTimetableSlot, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const LEVEL_ORDER: LevelGroup[] = ["pre_primary", "primary", "junior_school", "senior_school"];
const LEVEL_TAB: Record<LevelGroup, string> = {
  pre_primary: "Pre-Primary",
  primary: "Primary",
  junior_school: "Junior School",
  senior_school: "Senior School",
};
const LEVEL_BADGE: Record<LevelGroup, string> = {
  pre_primary: "Pre-Primary",
  primary: "Primary School",
  junior_school: "Junior School",
  senior_school: "Senior School",
};
const LEVEL_BANNER: Record<LevelGroup, string> = {
  pre_primary: "from-[#b3262b] to-[#7a1317]",
  primary: "from-primary to-[#6e1316]",
  junior_school: "from-[#8f1c20] to-[#5c0f12]",
  senior_school: "from-[#7a1317] to-[#47090c]",
};

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

interface NextLesson {
  slot: MyTimetableSlot;
  daysAway: number;
  inProgress: boolean;
}

/** The soonest lesson for a class: one in progress counts, otherwise the next
 * upcoming one, rolling into next week when this week's are all over. */
function nextLessonFor(classId: number, timetable: MyTimetableSlot[], now: Date): NextLesson | null {
  const jsDay = now.getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best: (NextLesson & { when: number }) | null = null;

  for (const slot of timetable) {
    if (slot.class_id !== classId) continue;
    const dayOffset = (slot.day_of_week - todayIdx + 7) % 7;
    const start = timeToMinutes(slot.start_time);
    const end = timeToMinutes(slot.end_time);
    let when = dayOffset * 1440 + start - nowMin;
    let inProgress = false;
    if (dayOffset === 0 && start <= nowMin) {
      if (nowMin < end) {
        inProgress = true;
        when = 0;
      } else {
        when += 7 * 1440;
      }
    }
    if (!best || when < best.when) {
      best = { slot, when, inProgress, daysAway: Math.floor((when + nowMin) / 1440) };
    }
  }
  return best ? { slot: best.slot, daysAway: best.daysAway, inProgress: best.inProgress } : null;
}

function nextLessonDay(next: NextLesson) {
  if (next.inProgress) return "Now";
  if (next.daysAway === 0) return "Today";
  if (next.daysAway === 1) return "Tomorrow";
  if (next.daysAway >= 7) return "Next week";
  return DAY_NAMES[next.slot.day_of_week];
}

interface ClassModel {
  c: MyClass;
  level: LevelGroup | null;
  next: NextLesson | null;
  progress: { done: number; total: number } | null;
}

function SubjectChips({ subjects, limit }: { subjects: MyClass["subjects"]; limit: number }) {
  if (subjects.length === 0) return <span className="text-xs text-muted-foreground">Class teacher only — no subjects assigned</span>;
  const shown = subjects.slice(0, limit);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((s) => (
        <span key={s.subject_id} className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${subjectStyle(s.subject_name)}`}>
          {s.subject_name}
        </span>
      ))}
      {subjects.length > limit && (
        <span className="rounded-full border bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">+{subjects.length - limit}</span>
      )}
    </div>
  );
}

function ProgressBar({ progress, loaded }: { progress: ClassModel["progress"]; loaded: boolean }) {
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Lesson plan covered</span>
        <span className="font-medium tabular-nums">{progress ? `${pct}%` : loaded ? "No plan yet" : "—"}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Lesson plan covered"
        title={progress ? `${progress.done} of ${progress.total} lessons covered` : undefined}
      >
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RegisterPill({ c }: { c: MyClass }) {
  if (!c.can_mark_attendance) return null;
  return c.attendance_marked_today ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-800">
      <CheckCircle2 className="size-3" /> Register marked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800">
      <ClipboardCheck className="size-3" /> Register pending
    </span>
  );
}

function ClassDetails({ model, timetable }: { model: ClassModel; timetable: MyTimetableSlot[] }) {
  const { c, level } = model;
  const lessons = timetable
    .filter((s) => s.class_id === c.class_id)
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" className="h-10 flex-1 sm:h-9">
            <Info /> Class details
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {c.class_name}
            {level && <Badge variant="secondary">{LEVEL_BADGE[level]}</Badge>}
            {c.is_homeroom_teacher && <Badge>Class teacher</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-4" /> {c.student_count} learner{c.student_count === 1 ? "" : "s"}
          </span>
          <RegisterPill c={c} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Subjects you teach here</p>
          <SubjectChips subjects={c.subjects} limit={c.subjects.length} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Lessons this week</p>
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons are scheduled for this class.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {lessons.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <span className="w-10 shrink-0 font-medium">{DAYS[s.day_of_week]}</span>
                  <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatTime24(s.start_time)} – {formatTime24(s.end_time)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.subject_name}</span>
                  {s.room && <span className="shrink-0 text-xs text-muted-foreground">{s.room}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {c.can_mark_attendance && (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/attendance?class_id=${c.class_id}`}><ClipboardCheck /> Attendance</Link>} />
          )}
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/results">Grading</Link>} />
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/lesson-plans">Lesson plans</Link>} />
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/homework">Homework</Link>} />
          <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/dashboard/students?class_id=${c.class_id}`}>Roster</Link>} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NextLessonBlock({ next }: { next: NextLesson | null }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <CalendarClock className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.7rem] text-muted-foreground">Next lesson</p>
        {next ? (
          <>
            <p className="text-sm leading-tight font-semibold tabular-nums">
              {formatTime24(next.slot.start_time)} – {formatTime24(next.slot.end_time)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {next.slot.subject_name} · {nextLessonDay(next)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">None scheduled</p>
        )}
      </div>
    </div>
  );
}

function ClassCard({ model, timetable, plansLoaded }: { model: ClassModel; timetable: MyTimetableSlot[]; plansLoaded: boolean }) {
  const { c, level, next, progress } = model;
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <div className={`relative h-24 bg-gradient-to-br ${level ? LEVEL_BANNER[level] : "from-primary to-[#6e1316]"}`}>
        <BookOpen className="pointer-events-none absolute -right-3 -bottom-5 size-24 text-white/10" strokeWidth={1} aria-hidden />
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sidebar-primary/70" aria-hidden />
        <div className="relative flex items-start justify-between gap-2 p-3">
          {level ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[0.7rem] font-semibold text-primary">
              <GraduationCap className="size-3.5" /> {LEVEL_BADGE[level]}
            </span>
          ) : (
            <span />
          )}
          <RegisterPill c={c} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg leading-tight font-semibold">{c.class_name}</h3>
            {c.is_homeroom_teacher && (
              <Badge className="gap-1">
                <GraduationCap className="size-3" /> Class teacher
              </Badge>
            )}
          </div>
          <div className="mt-2">
            <SubjectChips subjects={c.subjects} limit={3} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-y py-3">
          <div className="flex items-start gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Users className="size-4" />
            </span>
            <div>
              <p className="text-sm leading-tight font-semibold tabular-nums">{c.student_count}</p>
              <p className="text-xs text-muted-foreground">Learner{c.student_count === 1 ? "" : "s"}</p>
            </div>
          </div>
          <NextLessonBlock next={next} />
        </div>

        <ProgressBar progress={progress} loaded={plansLoaded} />

        <div className="mt-auto flex flex-col gap-2 sm:flex-row">
          <Button className="h-10 flex-1 sm:h-9" nativeButton={false} render={<Link href={`/dashboard/students?class_id=${c.class_id}`}>View class <ArrowRight /></Link>} />
          <ClassDetails model={model} timetable={timetable} />
        </div>
      </div>
    </article>
  );
}

function ClassRow({ model, timetable, plansLoaded }: { model: ClassModel; timetable: MyTimetableSlot[]; plansLoaded: boolean }) {
  const { c, level, next, progress } = model;
  return (
    <article className="grid items-center gap-x-6 gap-y-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base leading-tight font-semibold">{c.class_name}</h3>
            {level && <Badge variant="secondary">{LEVEL_BADGE[level]}</Badge>}
            {c.is_homeroom_teacher && <Badge>Class teacher</Badge>}
            <RegisterPill c={c} />
          </div>
          <div className="mt-1.5">
            <SubjectChips subjects={c.subjects} limit={4} />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-amber-600" />
          <span className="font-semibold tabular-nums">{c.student_count}</span>
          <span className="text-muted-foreground">learner{c.student_count === 1 ? "" : "s"}</span>
        </div>
        <NextLessonBlock next={next} />
      </div>
      <ProgressBar progress={progress} loaded={plansLoaded} />
      <div className="flex flex-col gap-2 sm:flex-row lg:min-w-64">
        <Button className="h-10 flex-1 sm:h-9" nativeButton={false} render={<Link href={`/dashboard/students?class_id=${c.class_id}`}>View class <ArrowRight /></Link>} />
        <ClassDetails model={model} timetable={timetable} />
      </div>
    </article>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: number | string;
  sub: string;
  href?: string;
}) {
  const body = (
    <div className={`flex h-full items-center gap-3 rounded-xl border bg-card p-3.5 sm:gap-4 sm:p-4 ${href ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full sm:size-12 ${tone}`}>
        <Icon className="size-5 sm:size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl leading-tight font-semibold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      {href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

function WeeklyTimetable({ timetable }: { timetable: MyTimetableSlot[] }) {
  const todayIndex = (() => {
    const d = new Date().getDay();
    return d === 0 ? -1 : d - 1;
  })();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const rows = useMemo(() => {
    const seen: Record<string, { start: string; end: string }> = {};
    for (const slot of timetable) {
      const key = `${slot.start_time}-${slot.end_time}`;
      if (!seen[key]) seen[key] = { start: slot.start_time, end: slot.end_time };
    }
    return Object.values(seen).sort((a, b) => a.start.localeCompare(b.start));
  }, [timetable]);

  function slotFor(day: number, start: string, end: string) {
    return timetable.find((s) => s.day_of_week === day && s.start_time === start && s.end_time === end);
  }

  return (
    <Card id="my-timetable" className="scroll-mt-20">
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

export default function MyClassesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;

  const [classes, setClasses] = useState<MyClass[]>([]);
  const [timetable, setTimetable] = useState<MyTimetableSlot[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [classesFailed, setClassesFailed] = useState(false);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const [tab, setTab] = useState<"all" | LevelGroup>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!loading && user && user.role !== "teacher") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    let myClassesFailed = false;
    let plansFetched = true;

    Promise.all([
      api.listMyClasses(token, schoolId).catch(() => {
        myClassesFailed = true;
        return [] as MyClass[];
      }),
      api.listMyTimetable(token, schoolId).catch(() => [] as MyTimetableSlot[]),
      api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
      api.listGradeLevels(token).catch(() => [] as GradeLevel[]),
      api.listLessonPlans(token, schoolId).catch(() => {
        plansFetched = false;
        return [] as LessonPlan[];
      }),
      api.listAcademicTerms(token, schoolId).catch(() => [] as AcademicTerm[]),
    ]).then(([cs, tt, scs, gl, lp, ts]) => {
      if (cancelled) return;
      setClasses(cs);
      setTimetable(tt);
      setSchoolClasses(scs);
      setGrades(gl);
      setPlans(lp);
      setTerms(ts);
      setClassesFailed(myClassesFailed);
      setPlansLoaded(plansFetched);
      setDataLoading(false);
      setRetrying(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, reloadKey]);

  function retry() {
    setRetrying(true);
    setReloadKey((k) => k + 1);
  }

  const models = useMemo<ClassModel[]>(() => {
    const groupByGrade: Record<number, LevelGroup> = {};
    for (const g of grades) groupByGrade[g.id] = g.level_group;
    const levelByClass: Record<number, LevelGroup> = {};
    for (const sc of schoolClasses) {
      if (sc.grade_level_id != null && groupByGrade[sc.grade_level_id]) levelByClass[sc.id] = groupByGrade[sc.grade_level_id];
    }

    // Coverage of this term's lesson plans for the subjects the teacher teaches in each class.
    const currentTerm = terms.find((t) => t.is_current)?.name;
    const termPlans = currentTerm ? plans.filter((p) => p.term === currentTerm) : plans;

    return classes
      .map((c) => {
        const subjectIds = new Set(c.subjects.map((s) => s.subject_id));
        let done = 0;
        let total = 0;
        for (const p of termPlans) {
          if (p.class_id === c.class_id && subjectIds.has(p.subject_id)) {
            done += p.completed_count;
            total += p.entry_count;
          }
        }
        return {
          c,
          level: levelByClass[c.class_id] ?? null,
          next: nextLessonFor(c.class_id, timetable, now),
          progress: total > 0 ? { done, total } : null,
        };
      })
      .sort((a, b) => {
        if (a.c.is_homeroom_teacher !== b.c.is_homeroom_teacher) return a.c.is_homeroom_teacher ? -1 : 1;
        return a.c.class_name.localeCompare(b.c.class_name);
      });
  }, [classes, timetable, schoolClasses, grades, plans, terms, now]);

  if (loading || dataLoading) return <PageLoader />;

  const todayIdx = now.getDay() === 0 ? -1 : now.getDay() - 1;
  const totalLearners = classes.reduce((sum, c) => sum + c.student_count, 0);
  const distinctSubjects = new Set(classes.flatMap((c) => c.subjects.map((s) => s.subject_id))).size;
  const lessonsToday = timetable.filter((s) => s.day_of_week === todayIdx).length;

  const availableLevels = LEVEL_ORDER.filter((l) => models.some((m) => m.level === l));
  const activeTab = tab !== "all" && !availableLevels.includes(tab) ? "all" : tab;
  const q = search.trim().toLowerCase();
  const filtered = models.filter((m) => {
    if (activeTab !== "all" && m.level !== activeTab) return false;
    if (!q) return true;
    return (
      m.c.class_name.toLowerCase().includes(q) ||
      m.c.subjects.some((s) => s.subject_name.toLowerCase().includes(q)) ||
      (m.level ? LEVEL_BADGE[m.level].toLowerCase().includes(q) : false)
    );
  });

  const pageSize = view === "grid" ? 6 : 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const from = (currentPage - 1) * pageSize;
  const visible = filtered.slice(from, from + pageSize);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-14">
          <Users className="size-6 sm:size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">My Classes</h1>
          <p className="text-sm text-muted-foreground">View and manage the classes you are assigned to.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          icon={Users}
          tone="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          label="Total Classes"
          value={classes.length}
          sub="Classes assigned to you"
          href="#class-list"
        />
        <StatCard
          icon={GraduationCap}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          label="Total Learners"
          value={totalLearners}
          sub="Across all your classes"
          href="/dashboard/students"
        />
        <StatCard
          icon={BookOpen}
          tone="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
          label="Subjects"
          value={distinctSubjects}
          sub="Subjects you teach"
        />
        <StatCard
          icon={CalendarDays}
          tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          label="Today's Lessons"
          value={lessonsToday}
          sub="Scheduled lessons"
          href="#my-timetable"
        />
      </div>

      {classesFailed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50/50 px-4 py-10 text-center dark:border-red-900/50 dark:bg-red-950/10">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load your classes.</p>
          <Button size="sm" variant="outline" onClick={retry} disabled={retrying}>
            <RotateCw className={retrying ? "animate-spin" : ""} /> Try again
          </Button>
        </div>
      ) : classes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <GraduationCap className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No classes assigned to you yet</p>
            <p className="text-xs text-muted-foreground">Ask your school admin to set up your teaching assignments.</p>
          </CardContent>
        </Card>
      ) : (
        <section id="class-list" className="flex scroll-mt-20 flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {availableLevels.length >= 2 ? (
              <div role="tablist" aria-label="Filter by school level" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
                {(["all", ...availableLevels] as const).map((key) => {
                  const selected = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => {
                        setTab(key);
                        setPage(1);
                      }}
                      className={`min-h-10 shrink-0 rounded-lg border px-4 text-sm font-medium transition-colors ${
                        selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                      }`}
                    >
                      {key === "all" ? "All Classes" : LEVEL_TAB[key]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-72 lg:flex-none">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search class name or subject..."
                  aria-label="Search classes"
                  className="h-10 bg-card pl-8"
                />
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-lg border bg-card" role="group" aria-label="Layout">
                {(
                  [
                    { key: "grid", icon: LayoutGrid, label: "Grid view" },
                    { key: "list", icon: List, label: "List view" },
                  ] as const
                ).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    aria-pressed={view === key}
                    onClick={() => {
                      setView(key);
                      setPage(1);
                    }}
                    className={`flex size-10 items-center justify-center transition-colors ${
                      view === key ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-12 text-center">
              <p className="text-sm font-medium">No classes match your search</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different name, subject, or level.</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((m) => (
                <ClassCard key={m.c.class_id} model={m} timetable={timetable} plansLoaded={plansLoaded} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((m) => (
                <ClassRow key={m.c.class_id} model={m} timetable={timetable} plansLoaded={plansLoaded} />
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {totalPages === 1
                  ? `Showing ${filtered.length} of ${filtered.length} class${filtered.length === 1 ? "" : "es"}`
                  : `Showing ${from + 1}–${from + visible.length} of ${filtered.length} classes`}
              </p>
              {totalPages > 1 && (
                <nav aria-label="Pagination" className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="size-10 sm:size-9">
                    <ChevronLeft />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <Button
                      key={n}
                      variant={n === currentPage ? "default" : "outline"}
                      size="icon"
                      aria-label={`Page ${n}`}
                      aria-current={n === currentPage ? "page" : undefined}
                      onClick={() => setPage(n)}
                      className="size-10 sm:size-9"
                    >
                      {n}
                    </Button>
                  ))}
                  <Button variant="outline" size="icon" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="size-10 sm:size-9">
                    <ChevronRight />
                  </Button>
                </nav>
              )}
            </div>
          )}
        </section>
      )}

      {timetable.length > 0 && <WeeklyTimetable timetable={timetable} />}
    </div>
  );
}
