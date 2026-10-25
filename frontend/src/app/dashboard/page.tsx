"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ClipboardCheck,
  Award,
  Wallet,
  Wallet2,
  Video,
  Megaphone,
  ArrowRight,
  Settings2,
  HeartHandshake,
  Bus,
  UserPlus,
  CalendarDays,
  FileText,
  ShieldCheck,
  BedDouble,
  BookOpenCheck,
  Map,
  Eye,
  GraduationCap,
  UserCheck,
  MessageSquareWarning,
  Plus,
  BellRing,
  CalendarClock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ClipboardList,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { toast } from "sonner";
import {
  api,
  ApiError,
  AttendanceRecord,
  DashboardSummary,
  GroupSummary,
  HomeworkListItem,
  MyClass,
  MyTimetableSlot,
  SupervisorOverview as SupervisorOverviewData,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { localDateStr } from "@/lib/dates";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function todayLabel(d: Date = new Date()) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function greet(d: Date = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatAgo(iso: string) {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.floor(mins)} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h ago`;
  const days = Math.floor(mins / 1440);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  student: Users,
  attendance: ClipboardCheck,
  fee_invoice: Wallet,
  fee_payment: Wallet,
  result: Award,
  lead: UserPlus,
  calendar_event: CalendarDays,
  announcement: Megaphone,
};

function Metric({
  label,
  value,
  sub,
  meterPercent,
  meterClassName,
  href,
}: {
  label: string;
  value: string | number;
  sub: string;
  meterPercent?: number;
  meterClassName?: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
        <CardContent className="flex flex-col gap-1.5 pt-6">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="font-heading text-2xl font-semibold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
          {meterPercent !== undefined && (
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${meterClassName ?? "bg-primary"}`}
                style={{ width: `${Math.min(100, Math.max(0, meterPercent))}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function AdminDashboard({ schoolId }: { schoolId: number }) {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .getDashboardSummary(token, schoolId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [token, schoolId]);

  if (loading) return <PageLoader />;
  if (!summary) return null;

  const diff =
    summary.today_attendance_rate != null && summary.yesterday_attendance_rate != null
      ? summary.today_attendance_rate - summary.yesterday_attendance_rate
      : null;

  const chartData = summary.attendance_trend.map((p) => ({
    date: p.date,
    label: new Date(p.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" }),
    rate: p.rate,
    isToday: p.date === localDateStr(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greet()}, ${user?.full_name.split(" ")[0]}`}
        description={todayLabel()}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/attendance"><Button variant="outline"><CalendarDays />Take attendance</Button></Link>
            <Link href="/dashboard/fees"><Button variant="outline"><Wallet />Record payment</Button></Link>
            <Link href="/dashboard/students"><Button><UserPlus />Add student</Button></Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total students" value={summary.total_students.toLocaleString()} sub="Currently enrolled" href="/dashboard/students" />
        <Metric
          label="Active staff"
          value={summary.active_staff}
          sub={`${summary.total_staff - summary.active_staff} inactive · ${summary.total_staff} on record`}
          href="/dashboard/staff"
        />
        <Metric
          label="Fee collection rate"
          value={`${summary.fee_collection_rate.toFixed(1)}%`}
          sub={`KES ${summary.amount_paid.toLocaleString()} of ${summary.amount_billed.toLocaleString()} billed`}
          meterPercent={summary.fee_collection_rate}
          meterClassName="bg-amber-500"
          href="/dashboard/fees"
        />
        <Metric
          label="Daily attendance"
          value={summary.today_attendance_rate == null ? "—" : `${summary.today_attendance_rate.toFixed(1)}%`}
          sub={`${summary.classes_marked_today} of ${summary.classes_total} registers in${diff != null ? ` · ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts vs yesterday` : ""}`}
          meterPercent={summary.today_attendance_rate ?? 0}
          href="/dashboard/attendance"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance</CardTitle>
            <CardDescription>Share of learners present or late, last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} fontSize={12} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  cursor={{ fill: "var(--accent)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)}%` : "Not marked", "Attendance"]}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.date} fill={d.isToday ? "var(--primary)" : "var(--chart-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Across finance, academics and admissions</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.recent_activity.length ? (
              <ul className="flex flex-col gap-3">
                {summary.recent_activity.map((a, i) => {
                  const Icon = ACTIVITY_ICONS[a.entity_type] ?? FileText;
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-sm">
                          <span className="capitalize">{a.action}</span> {a.entity_type.replace(/_/g, " ")}
                          {a.actor_name ? ` by ${a.actor_name}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatAgo(a.created_at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet. New payments, registers and admissions appear here.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Registers not marked today</CardTitle>
              <CardDescription>
                {summary.pending_registers.length ? "Guardians are only alerted about absence once a register is saved" : "Every class has marked attendance today"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {summary.pending_registers.length ? (
              <ul className="flex flex-col gap-2">
                {summary.pending_registers.map((r) => (
                  <li key={r.class_id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                    <div>
                      <p className="text-sm font-medium">{r.class_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.teacher_name ? `Class teacher: ${r.teacher_name}` : "No class teacher assigned"} · {r.student_count} learners
                      </p>
                    </div>
                    <Link href={`/dashboard/attendance?class_id=${r.class_id}`}>
                      <Button size="sm" variant="outline">Mark now</Button>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All {summary.classes_total} registers are in for today.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Largest balances</CardTitle>
              <CardDescription>Outstanding this term</CardDescription>
            </div>
            <Link href="/dashboard/fees"><Button size="sm" variant="ghost">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {summary.top_balances.length ? (
              <ul className="flex flex-col gap-2">
                {summary.top_balances.map((b) => (
                  <li key={b.student_id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                    <div>
                      <p className="text-sm font-medium">{b.student_name}</p>
                      <p className="text-xs text-muted-foreground">{b.admission_number}{b.class_name ? ` · ${b.class_name}` : ""}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">KES {b.balance.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No outstanding balances.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  { href: "/dashboard/staff-attendance", label: "Staff Attendance", description: "Clock in/out and your duties", icon: ClipboardCheck, roles: ["teacher", "staff", "security", "boarding_staff", "transport_staff", "bursar"] },
  { href: "/dashboard/students", label: "Students", description: "Enroll and manage student records", icon: Users, roles: ["teacher", "staff"] },
  { href: "/dashboard/attendance", label: "Attendance", description: "Mark today's attendance by class", icon: ClipboardCheck, roles: ["teacher", "staff"] },
  { href: "/dashboard/results", label: "Results", description: "Record scores and view grades", icon: Award, roles: ["teacher", "staff"] },
  { href: "/dashboard/fees", label: "Fees", description: "Invoices, payments, and balances", icon: Wallet, roles: ["staff", "bursar"] },
  { href: "/dashboard/transport", label: "Transport", description: "Vehicles, routes, and student assignments", icon: Bus, roles: ["staff", "transport_staff"] },
  { href: "/dashboard/calendar", label: "Calendar", description: "Meetings, exams, and school events", icon: CalendarDays, roles: ["teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar"] },
  { href: "/dashboard/live-classes", label: "Live Classes", description: "Schedule and host video lessons", icon: Video, roles: ["teacher", "staff"] },
  { href: "/dashboard/announcements", label: "Announcements", description: "Share updates with your school", icon: Megaphone, roles: ["teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar"] },
  { href: "/dashboard/complaints", label: "Complaints", description: "Raise a concern with the class teacher or principal", icon: MessageSquareWarning, roles: ["teacher", "student", "parent"] },
  { href: "/dashboard/children", label: "My Children", description: "View attendance, results, and fees", icon: HeartHandshake, roles: ["parent"] },
  { href: "/dashboard/my-records", label: "My Records", description: "Your attendance, results, and fees", icon: Award, roles: ["student"] },
  { href: "/dashboard/security", label: "Security", description: "Visitor log, vehicles, and gate incidents", icon: ShieldCheck, roles: ["security"] },
  { href: "/dashboard/pickup-dropoff", label: "Pickup / Drop-off", description: "Verify and log early pickups", icon: UserPlus, roles: ["security"] },
  { href: "/dashboard/boarding", label: "Boarding", description: "Roll call, exeats, and sick bay", icon: BedDouble, roles: ["boarding_staff"] },
  { href: "/dashboard/trips", label: "Trips", description: "Today's routes and trip logs", icon: Map, roles: ["transport_staff"] },
  { href: "/dashboard/finance", label: "Finance", description: "Expenses and income/expense summary", icon: Wallet2, roles: ["bursar"] },
  { href: "/dashboard/ledger", label: "Ledger", description: "Chart of accounts and journal entries", icon: BookOpenCheck, roles: ["bursar"] },
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALERT_LIMIT = 5;

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime24(t: string) {
  return t.slice(0, 5);
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Monday of the week the timetable tabs describe — on a Sunday, the week
 * that is about to start rather than the one that just ended. */
function weekStart(now: Date) {
  const jsDay = now.getDay();
  const monday = addDays(now, jsDay === 0 ? 1 : 1 - jsDay);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function daysUntil(dueDate: string, today: string) {
  const ms = new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function longDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function dueLabel(daysLeft: number) {
  if (daysLeft < 0) return `Overdue by ${-daysLeft} day${daysLeft === -1 ? "" : "s"}`;
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `Due in ${daysLeft} days`;
}

interface RegisterSummary {
  marked: boolean;
  recorded: number;
  present: number;
  absent: number;
  late: number;
  total: number;
}

interface SubmissionAlert {
  hw: HomeworkListItem;
  missing: number;
  unmarked: number;
  reviewed: number;
  daysLeft: number;
  overdue: boolean;
}

const NO_FAILURES = { classes: false, timetable: false, homework: false, register: false };

type StatTone = "primary" | "emerald" | "amber" | "red";

const STAT_TONES: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function TeacherStat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
  meter,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: React.ReactNode;
  tone?: StatTone;
  meter?: { percent: number; className: string };
  href?: string;
}) {
  const card = (
    <Card className={`h-full sm:min-h-32 ${href ? "transition-colors hover:border-primary/40 hover:bg-accent/40" : ""}`}>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${STAT_TONES[tone]}`}>
            <Icon className="size-4" />
          </span>
          <span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-heading text-2xl leading-none font-semibold tabular-nums sm:text-3xl">{value}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
        {meter && (
          <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${meter.className}`} style={{ width: `${Math.min(100, Math.max(0, meter.percent))}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return (
    <Link href={href} className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  );
}

function RetryNotice({ message, onRetry, busy }: { message: string; onRetry: () => void; busy: boolean }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-red-200 bg-red-50/50 px-4 py-8 text-center dark:border-red-900/50 dark:bg-red-950/10"
    >
      <AlertTriangle className="size-5 text-red-600" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={busy}>
        <RotateCw className={busy ? "animate-spin" : ""} /> Try again
      </Button>
    </div>
  );
}

interface TeacherData {
  classes: MyClass[];
  timetable: MyTimetableSlot[];
  homework: HomeworkListItem[];
  register: RegisterSummary | null;
  failed: typeof NO_FAILURES;
}

async function fetchTeacherData(token: string, schoolId: number): Promise<TeacherData> {
  const failed = { ...NO_FAILURES };
  const [classes, timetable, homework] = await Promise.all([
    api.listMyClasses(token, schoolId).catch(() => {
      failed.classes = true;
      return [] as MyClass[];
    }),
    api.listMyTimetable(token, schoolId).catch(() => {
      failed.timetable = true;
      return [] as MyTimetableSlot[];
    }),
    api.listHomework(token, schoolId).catch(() => {
      failed.homework = true;
      return [] as HomeworkListItem[];
    }),
  ]);

  let register: RegisterSummary | null = null;
  const homeroom = classes.find((c) => c.is_homeroom_teacher);
  if (homeroom) {
    try {
      const records: AttendanceRecord[] = await api.listAttendance(token, schoolId, homeroom.class_id, localDateStr(new Date()));
      const absent = records.filter((r) => r.status === "absent").length;
      register = {
        marked: records.length > 0,
        recorded: records.length,
        // Same rule the rest of the system uses: anyone not marked absent was in school.
        present: records.length - absent,
        absent,
        late: records.filter((r) => r.status === "late").length,
        total: homeroom.student_count,
      };
    } catch {
      failed.register = true;
    }
  }
  return { classes, timetable, homework, register, failed };
}

function TeacherDashboard() {
  const { user, token } = useAuth();
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [timetable, setTimetable] = useState<MyTimetableSlot[]>([]);
  const [homework, setHomework] = useState<HomeworkListItem[]>([]);
  const [register, setRegister] = useState<RegisterSummary | null>(null);
  const [failed, setFailed] = useState(NO_FAILURES);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [remindedIds, setRemindedIds] = useState<Set<number>>(() => new Set());
  const [now, setNow] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 0 : d - 1;
  });

  // Keeps "Now"/"Done" and the date honest if the page is left open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const schoolId = user?.school_id ?? null;

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    fetchTeacherData(token, schoolId).then((data) => {
      if (cancelled) return;
      setClasses(data.classes);
      setTimetable(data.timetable);
      setHomework(data.homework);
      setRegister(data.register);
      setFailed(data.failed);
      setLoading(false);
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

  async function handleRemind(hw: HomeworkListItem) {
    if (!token || !user?.school_id) return;
    setRemindingId(hw.id);
    try {
      const result = await api.remindHomework(token, user.school_id, hw.id);
      if (result.reminded > 0) {
        setRemindedIds((ids) => new Set(ids).add(hw.id));
        toast.success(`Reminder sent for ${result.reminded} learner${result.reminded === 1 ? "" : "s"}`);
      } else {
        toast.info("Everyone has already handed this in");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send reminder");
    } finally {
      setRemindingId(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`${greet()}, ${user?.full_name.split(" ")[0] ?? ""}`} description={todayLabel()} />
        <PageLoader />
      </div>
    );
  }

  const firstName = user.full_name.split(" ")[0];
  const todayStr = localDateStr(now);
  const jsDay = now.getDay();
  const todayIndex = jsDay === 0 ? -1 : jsDay - 1;
  const monday = weekStart(now);
  const selectedDate = addDays(monday, selectedDay);
  const isSelectedToday = selectedDay === todayIndex;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const classOf = (id: number) => classes.find((c) => c.class_id === id);
  const homeroomClasses = classes.filter((c) => c.is_homeroom_teacher);
  const homeroom = homeroomClasses[0];
  const registerClass = homeroom?.can_mark_attendance ? homeroom : classes.find((c) => c.can_mark_attendance);
  const canPostHomework = classes.some((c) => c.subjects.length > 0);

  const byStart = (a: MyTimetableSlot, b: MyTimetableSlot) => a.start_time.localeCompare(b.start_time);
  const todaySlots = timetable.filter((s) => s.day_of_week === todayIndex).sort(byStart);
  const daySlots = timetable.filter((s) => s.day_of_week === selectedDay).sort(byStart);
  const currentSlot = todaySlots.find((s) => timeToMinutes(s.start_time) <= nowMinutes && nowMinutes < timeToMinutes(s.end_time));
  const nextSlot = todaySlots.find((s) => timeToMinutes(s.start_time) > nowMinutes);

  // Only work the teacher is actually assigned to mark: same rule the backend
  // applies when they open a submission to review it.
  const myHomework = homework.filter((h) => classOf(h.class_id)?.subjects.some((s) => s.subject_id === h.subject_id));
  const alerts: SubmissionAlert[] = myHomework
    .map((hw) => {
      const daysLeft = daysUntil(hw.due_date, todayStr);
      return {
        hw,
        missing: Math.max(0, hw.total_students - hw.submitted_count),
        unmarked: Math.max(0, hw.submitted_count - hw.reviewed_count),
        reviewed: hw.reviewed_count,
        daysLeft,
        overdue: daysLeft < 0,
      };
    })
    .filter((a) => a.missing > 0 || a.unmarked > 0)
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      // Overdue: most recently due first, so long-stale items sink. Open: soonest due first.
      return a.overdue ? b.daysLeft - a.daysLeft : a.daysLeft - b.daysLeft;
    });
  const visibleAlerts = alerts.slice(0, ALERT_LIMIT);
  const overdueCount = alerts.filter((a) => a.overdue).length;
  const submissionsToMark = myHomework.reduce((sum, h) => sum + Math.max(0, h.submitted_count - h.reviewed_count), 0);
  const assignmentsToMark = myHomework.filter((h) => h.submitted_count > h.reviewed_count).length;

  const attendancePct = register && register.marked && register.total > 0 ? Math.min(100, Math.round((register.present / register.total) * 100)) : null;
  const attendanceTone: StatTone = attendancePct === null ? "amber" : attendancePct >= 80 ? "emerald" : attendancePct >= 60 ? "amber" : "red";
  const attendanceHref = homeroom ? `/dashboard/attendance?class_id=${homeroom.class_id}` : undefined;

  const roleLabel = homeroom ? "Class teacher" : "Subject teacher";
  const classLabel = homeroom
    ? homeroomClasses.map((c) => c.class_name).join(", ")
    : classes.length > 0
    ? `${classes.length} class${classes.length === 1 ? "" : "es"}`
    : "";

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#6e1316] px-5 py-4 text-primary-foreground shadow-sm sm:px-6 sm:py-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-sidebar-primary" aria-hidden />
        <GraduationCap className="pointer-events-none absolute -right-4 -bottom-6 size-28 text-white/10" strokeWidth={1} aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="rounded-full bg-sidebar-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-sidebar-primary uppercase">
                {roleLabel}
              </span>
              {classLabel && <span className="truncate text-xs text-primary-foreground/75">{classLabel}</span>}
            </div>
            <h1 className="mt-1.5 truncate font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              {greet(now)}, {firstName}
            </h1>
            <p className="mt-0.5 text-xs text-primary-foreground/70">{todayLabel(now)}</p>
          </div>
          {(registerClass || canPostHomework) && (
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {registerClass && (
                <Button
                  variant="secondary"
                  nativeButton={false}
                  className="h-10 flex-1 justify-center sm:h-9 sm:flex-none"
                  render={
                    <Link href={`/dashboard/attendance?class_id=${registerClass.class_id}`}>
                      <ClipboardCheck /> Class register
                    </Link>
                  }
                />
              )}
              {canPostHomework && (
                <Button
                  nativeButton={false}
                  className="h-10 flex-1 justify-center bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:h-9 sm:flex-none"
                  render={
                    <Link href="/dashboard/homework">
                      <Plus /> New assignment
                    </Link>
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <TeacherStat
          icon={UserCheck}
          label={homeroom ? `${homeroom.class_name} attendance` : "Class attendance"}
          tone={attendanceTone}
          value={attendancePct !== null ? `${attendancePct}%` : register && !register.marked ? "Not taken" : "—"}
          sub={
            failed.classes
              ? "Couldn't load your classes"
              : !homeroom
              ? "You're not a class teacher"
              : failed.register
              ? "Couldn't load today's register"
              : register && !register.marked
              ? `Take today's register · ${register.total} learner${register.total === 1 ? "" : "s"}`
              : register
              ? `${register.present} of ${register.total} present${register.absent ? ` · ${register.absent} absent` : ""}${register.late ? ` · ${register.late} late` : ""}`
              : "—"
          }
          meter={attendancePct !== null ? { percent: attendancePct, className: attendanceTone === "emerald" ? "bg-emerald-500" : attendanceTone === "amber" ? "bg-amber-500" : "bg-red-500" } : undefined}
          href={attendanceHref}
        />
        <TeacherStat
          icon={ClipboardList}
          label="Submissions to mark"
          tone={submissionsToMark > 0 ? "amber" : "emerald"}
          value={failed.homework || failed.classes ? "—" : submissionsToMark}
          sub={
            failed.homework || failed.classes
              ? "Couldn't load assignments"
              : submissionsToMark > 0
              ? `Across ${assignmentsToMark} assignment${assignmentsToMark === 1 ? "" : "s"}`
              : "All caught up"
          }
          href="/dashboard/homework"
        />
        <TeacherStat
          icon={CalendarClock}
          label="Lessons today"
          value={failed.timetable ? "—" : todaySlots.length}
          sub={
            failed.timetable
              ? "Couldn't load your timetable"
              : currentSlot
              ? `Now: ${currentSlot.subject_name} · ${currentSlot.class_name}`
              : nextSlot
              ? `Next: ${formatTime24(nextSlot.start_time)} ${nextSlot.subject_name} · ${nextSlot.class_name}`
              : todaySlots.length > 0
              ? "All lessons done for today"
              : "No lessons scheduled today"
          }
          href="/dashboard/my-classes"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4.5" /> My timetable</CardTitle>
            <CardDescription>
              {longDate(selectedDate)}
              {isSelectedToday ? " · today" : ""}
              {!failed.timetable && ` · ${daySlots.length} lesson${daySlots.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div role="tablist" aria-label="Day of the week" className="grid grid-cols-6 gap-1.5">
              {DAY_SHORT.map((label, i) => {
                const selected = selectedDay === i;
                const isToday = i === todayIndex;
                return (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`${DAY_NAMES[i]} ${addDays(monday, i).getDate()}${isToday ? ", today" : ""}`}
                    onClick={() => setSelectedDay(i)}
                    className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-1 leading-tight transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : isToday
                        ? "border-primary/40 hover:bg-accent"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    <span className="text-[0.65rem] font-medium tracking-wide uppercase opacity-80">{label}</span>
                    <span className="relative text-sm font-semibold tabular-nums">
                      {addDays(monday, i).getDate()}
                      {isToday && <span className="absolute -top-0.5 -right-2 size-1.5 rounded-full bg-sidebar-primary" aria-hidden />}
                    </span>
                  </button>
                );
              })}
            </div>

            {failed.timetable ? (
              <RetryNotice message="We couldn't load your timetable." onRetry={retry} busy={retrying} />
            ) : daySlots.length > 0 ? (
              <ol className="flex flex-col gap-2">
                {daySlots.map((s) => {
                  const isNow = isSelectedToday && s.id === currentSlot?.id;
                  const isNext = isSelectedToday && !currentSlot && s.id === nextSlot?.id;
                  const isDone = isSelectedToday && timeToMinutes(s.end_time) <= nowMinutes;
                  const klass = classOf(s.class_id);
                  const canRegister = isSelectedToday && !!klass?.can_mark_attendance;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 rounded-lg border p-2.5 ${isNow ? "border-primary/50 bg-primary/5" : ""} ${isDone ? "opacity-60" : ""}`}
                    >
                      <div className="flex w-12 shrink-0 flex-col text-xs leading-snug text-muted-foreground tabular-nums">
                        <span className="font-medium text-foreground">{formatTime24(s.start_time)}</span>
                        <span>{formatTime24(s.end_time)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{s.subject_name}</p>
                          {isNow && <Badge className="shrink-0">Now</Badge>}
                          {isNext && <Badge variant="outline" className="shrink-0 border-sidebar-primary text-primary">Next</Badge>}
                        </div>
                        <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">{s.class_name}</span>
                          {s.room && (
                            <>
                              <span aria-hidden>·</span>
                              <MapPin className="size-3 shrink-0" aria-hidden />
                              <span className="truncate">{s.room}</span>
                            </>
                          )}
                        </p>
                      </div>
                      {canRegister && (
                        <Button
                          size="sm"
                          variant={klass?.attendance_marked_today ? "ghost" : "outline"}
                          nativeButton={false}
                          className="h-9 shrink-0 sm:h-7"
                          render={
                            <Link href={`/dashboard/attendance?class_id=${s.class_id}`}>
                              {klass?.attendance_marked_today ? (
                                <>
                                  <CheckCircle2 className="text-emerald-600" /> Registered
                                </>
                              ) : (
                                "Register"
                              )}
                            </Link>
                          }
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center">
                <CalendarClock className="size-5 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {timetable.length === 0 ? "No timetable has been set up for you yet" : `No lessons on ${DAY_NAMES[selectedDay]}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timetable.length === 0 ? "Ask your school admin to add your lessons." : "Pick another day to see your other lessons."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BellRing className="size-4.5" /> Submission alerts</CardTitle>
            <CardDescription>
              {alerts.length > 0
                ? `${overdueCount} overdue · ${alerts.length - overdueCount} still open`
                : "Open assignments in your classes"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {failed.homework || failed.classes ? (
              <RetryNotice message="We couldn't load your assignments." onRetry={retry} busy={retrying} />
            ) : visibleAlerts.length > 0 ? (
              <div className="flex flex-col gap-3">
                <ul className="flex flex-col gap-3">
                  {visibleAlerts.map((a, i) => {
                    const { hw } = a;
                    const className = classOf(hw.class_id)?.class_name ?? "";
                    const subject = classOf(hw.class_id)?.subjects.find((s) => s.subject_id === hw.subject_id)?.subject_name ?? "";
                    const total = Math.max(hw.total_students, 1);
                    const reminded = remindedIds.has(hw.id);
                    const dueTone = a.overdue
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : a.daysLeft === 0
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-muted text-muted-foreground";
                    const heading = i === 0 || visibleAlerts[i - 1].overdue !== a.overdue ? (a.overdue ? "Overdue" : "Still open") : null;
                    return (
                      <li key={hw.id} className="flex flex-col gap-3">
                        {heading && (
                          <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">{heading}</p>
                        )}
                        <div
                          className={`flex flex-col gap-2.5 rounded-lg border p-3 ${
                            a.overdue ? "border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/10" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-semibold">{hw.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {[className, subject].filter(Boolean).join(" · ")} · due {shortDate(hw.due_date)}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${dueTone}`}>{dueLabel(a.daysLeft)}</span>
                          </div>

                          <div
                            className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
                            role="img"
                            aria-label={`${a.reviewed} marked, ${a.unmarked} to mark, ${a.missing} missing`}
                          >
                            <div className="h-full bg-emerald-500" style={{ width: `${(a.reviewed / total) * 100}%` }} />
                            <div className="h-full bg-amber-400" style={{ width: `${(a.unmarked / total) * 100}%` }} />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                            <p className="text-xs text-muted-foreground">
                              {hw.submitted_count}/{hw.total_students} handed in
                              {a.unmarked > 0 && <span className="font-medium text-amber-700 dark:text-amber-400"> · {a.unmarked} to mark</span>}
                              {a.missing > 0 && (
                                <span className={a.overdue ? "font-medium text-red-700 dark:text-red-400" : ""}> · {a.missing} missing</span>
                              )}
                            </p>
                            <div className="flex gap-1.5">
                              {a.missing > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 sm:h-7"
                                  disabled={remindingId === hw.id || reminded}
                                  onClick={() => handleRemind(hw)}
                                >
                                  {reminded ? (
                                    <>
                                      <CheckCircle2 className="text-emerald-600" /> Reminded
                                    </>
                                  ) : remindingId === hw.id ? (
                                    "Sending..."
                                  ) : (
                                    "Remind"
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                nativeButton={false}
                                className="h-9 sm:h-7"
                                render={<Link href={`/dashboard/homework/${hw.id}`}>Review</Link>}
                              />
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {alerts.length > ALERT_LIMIT && (
                  <Link href="/dashboard/homework" className="text-xs font-medium text-primary hover:underline">
                    View all {alerts.length} assignments →
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <p className="text-sm font-medium">
                  {myHomework.length === 0 ? "No assignments posted yet" : "Nothing needs your attention"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {myHomework.length === 0
                    ? "Assignments you post for your classes will show up here."
                    : "Every assignment is handed in and marked."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SimpleDashboard() {
  const { user } = useAuth();
  if (!user) return null;
  const links = QUICK_LINKS.filter((l) => l.roles.includes(user.role));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Welcome, ${user.full_name.split(" ")[0]}`} description="Here's what's happening at your school today." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <link.icon className="size-4.5" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base">{link.label}</CardTitle>
                <CardDescription className="mt-1">{link.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {user.role === "super_admin" && (
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Super Admin</CardTitle>
            </div>
            <CardDescription>Onboard new schools and manage their modules and branding.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/schools" className="text-sm font-medium text-primary hover:underline">
              Go to schools console →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function kes(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function GroupOverview() {
  const { token, schoolOptions, switchSchool } = useAuth();
  const home = schoolOptions.find((o) => o.isHome);
  const [summary, setSummary] = useState<GroupSummary | null>(null);

  useEffect(() => {
    if (!token || !home) return;
    api.getGroupSummary(token, home.id).then(setSummary).catch(() => setSummary(null));
  }, [token, home]);

  if (!summary) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`${summary.group_name} · Group overview`} description={`${summary.rows.length} schools in your group.`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total students</p><p className="font-heading text-2xl font-semibold tabular-nums">{summary.total_students.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Active staff</p><p className="font-heading text-2xl font-semibold tabular-nums">{summary.total_active_staff.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Fee collection rate</p><p className="font-heading text-2xl font-semibold tabular-nums">{summary.overall_fee_collection_rate.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Billed vs collected</p><p className="font-heading text-2xl font-semibold tabular-nums">{kes(summary.total_amount_paid)}<span className="text-sm font-normal text-muted-foreground"> / {kes(summary.total_amount_billed)}</span></p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your schools</CardTitle><CardDescription>Open any school to see its own full dashboard.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Staff</TableHead>
                <TableHead className="text-right">Fee collection</TableHead><TableHead className="text-right">Attendance today</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map((row) => (
                <TableRow key={row.school_id}>
                  <TableCell className="font-medium">{row.name}{row.is_group && <Badge variant="secondary" className="ml-2">Group</Badge>}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total_students.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.active_staff.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.fee_collection_rate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.today_attendance_rate == null ? "—" : `${row.today_attendance_rate.toFixed(1)}%`}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => switchSchool(row.school_id)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SupervisorOverview() {
  const { token, user, switchSchool } = useAuth();
  const [overview, setOverview] = useState<SupervisorOverviewData | null>(null);

  useEffect(() => {
    if (!token) return;
    api.getSupervisorOverview(token).then(setOverview).catch(() => setOverview(null));
  }, [token]);

  if (!overview) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome, ${user?.full_name.split(" ")[0] ?? "Supervisor"}`}
        description={`Overseeing ${overview.schools.length} school${overview.schools.length === 1 ? "" : "s"} — pick one below to look inside.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><GraduationCap className="size-4.5" /></div>
            <div>
              <p className="font-heading text-2xl font-semibold tabular-nums">{overview.schools.length}</p>
              <p className="text-xs text-muted-foreground">Schools supervised</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="size-4.5" /></div>
            <div>
              <p className="font-heading text-2xl font-semibold tabular-nums">{overview.total_students.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserCheck className="size-4.5" /></div>
            <div>
              <p className="font-heading text-2xl font-semibold tabular-nums">{overview.total_active_staff.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Active staff</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your schools</CardTitle>
          <CardDescription>Open any school to see everything happening inside it — read-only until you choose to edit.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Staff</TableHead>
                <TableHead className="text-right">Fee collection</TableHead><TableHead className="text-right">Attendance today</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.schools.map((row) => (
                <TableRow key={row.school_id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total_students.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.active_staff.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.fee_collection_rate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.today_attendance_rate == null ? "—" : `${row.today_attendance_rate.toFixed(1)}%`}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => switchSchool(row.school_id)}><Eye className="size-3.5" /> View</Button>
                  </TableCell>
                </TableRow>
              ))}
              {overview.schools.length === 0 && (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No schools linked to your account yet — ask your super-admin.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { user, schoolOptions, viewingSchoolId } = useAuth();
  if (!user) return null;

  const home = schoolOptions.find((o) => o.isHome);
  const isViewingGroup = home !== undefined && viewingSchoolId === home.id;

  if (user.role === "head_of_institution" && user.school_id) {
    if (isViewingGroup) return <GroupOverview />;
    return <AdminDashboard schoolId={user.school_id} />;
  }
  if (user.role === "group_principal") {
    if (viewingSchoolId === null) return <SupervisorOverview />;
    return <AdminDashboard schoolId={viewingSchoolId} />;
  }
  if (user.role === "teacher") return <TeacherDashboard />;
  return <SimpleDashboard />;
}
