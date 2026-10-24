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
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Announcement, api, DashboardSummary, GroupSummary, MyClass, MyTimetableSlot, SupervisorOverview as SupervisorOverviewData } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function greet() {
  const h = new Date().getHours();
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
    isToday: p.date === new Date().toISOString().slice(0, 10),
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

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function TeacherDashboard() {
  const { user, token } = useAuth();
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [timetable, setTimetable] = useState<MyTimetableSlot[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listMyClasses(token, user.school_id).catch(() => []),
      api.listMyTimetable(token, user.school_id).catch(() => []),
      api.listAnnouncements(token, user.school_id).catch(() => []),
    ])
      .then(([cs, tt, an]) => {
        setClasses(cs);
        setTimetable(tt);
        setAnnouncements(an);
      })
      .finally(() => setLoading(false));
  }, [token, user?.school_id]);

  if (loading || !user) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`${greet()}, ${user?.full_name.split(" ")[0] ?? ""}`} description={todayLabel()} />
        <PageLoader />
      </div>
    );
  }

  const jsDay = new Date().getDay();
  const todayIndex = jsDay === 0 ? -1 : jsDay - 1;
  const todaySlots = timetable.filter((s) => s.day_of_week === todayIndex).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const currentSlot = todaySlots.find((s) => timeToMinutes(s.start_time) <= nowMinutes && nowMinutes < timeToMinutes(s.end_time));
  const nextSlot = !currentSlot ? todaySlots.find((s) => timeToMinutes(s.start_time) > nowMinutes) : undefined;

  const homeroomCount = classes.filter((c) => c.is_homeroom_teacher).length;
  const totalLearners = classes.reduce((sum, c) => sum + c.student_count, 0);
  const markableClasses = classes.filter((c) => c.can_mark_attendance);
  const pendingRegisters = markableClasses.filter((c) => !c.attendance_marked_today);
  const registersMarked = markableClasses.length - pendingRegisters.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greet()}, ${user.full_name.split(" ")[0]}`}
        description={todayLabel()}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/attendance"><Button variant="outline"><ClipboardCheck /> Take attendance</Button></Link>
            <Link href="/dashboard/results"><Button><Award /> Grading</Button></Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Classes you teach"
          value={classes.length}
          sub={homeroomCount ? `${homeroomCount} as class teacher` : "Subject teacher"}
          href="/dashboard/my-classes"
        />
        <Metric label="Learners" value={totalLearners} sub="Across all your classes" href="/dashboard/students" />
        <Metric
          label="Registers today"
          value={markableClasses.length ? `${registersMarked}/${markableClasses.length}` : "—"}
          sub={pendingRegisters.length ? `${pendingRegisters.length} still pending` : markableClasses.length ? "All marked" : "Nothing to mark"}
          meterPercent={markableClasses.length ? (registersMarked / markableClasses.length) * 100 : undefined}
          meterClassName={pendingRegisters.length ? "bg-amber-500" : "bg-emerald-500"}
          href="/dashboard/attendance"
        />
        <Metric
          label="Today's periods"
          value={todaySlots.length}
          sub={currentSlot ? `Now: ${currentSlot.subject_name}` : nextSlot ? `Next: ${nextSlot.subject_name}` : "No lessons scheduled"}
          href="/dashboard/timetable"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
            <CardDescription>
              {DAY_NAMES[todayIndex] ?? "Weekend"} · {todaySlots.length} period{todaySlots.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todaySlots.length ? (
              <ol className="flex flex-col gap-2">
                {todaySlots.map((s) => {
                  const isNow = s.id === currentSlot?.id;
                  const isNext = s.id === nextSlot?.id;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                        isNow
                          ? "border-primary/50 bg-primary/5"
                          : isNext
                          ? "border-amber-300/60 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                          : ""
                      }`}
                    >
                      <div className="flex w-24 shrink-0 flex-col items-start text-xs text-muted-foreground tabular-nums">
                        <span>{formatTime(s.start_time)}</span>
                        <span>{formatTime(s.end_time)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.subject_name} · {s.class_name}</p>
                        <p className="text-xs text-muted-foreground">{s.room ? `Room ${s.room}` : "No room set"}</p>
                      </div>
                      {isNow && <Badge className="shrink-0">Now</Badge>}
                      {!isNow && isNext && <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-700 dark:text-amber-400">Next</Badge>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No lessons scheduled for today.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest announcements</CardTitle>
            <CardDescription>From your school</CardDescription>
          </CardHeader>
          <CardContent>
            {announcements.length ? (
              <ul className="flex flex-col gap-3">
                {announcements.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Megaphone className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{formatAgo(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No announcements yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your classes</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Link
              key={c.class_id}
              href={c.can_mark_attendance ? `/dashboard/attendance?class_id=${c.class_id}` : `/dashboard/students?class_id=${c.class_id}`}
            >
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
                <CardContent className="flex flex-col gap-2 pt-6">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GraduationCap className="size-4" />
                      </div>
                      <p className="truncate font-heading text-sm font-semibold">{c.class_name}</p>
                    </div>
                    {c.is_homeroom_teacher && <Badge className="shrink-0">Class teacher</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.subjects.map((s) => (
                      <Badge key={s.subject_id} variant="secondary">{s.subject_name}</Badge>
                    ))}
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3" /> {c.student_count} learner{c.student_count === 1 ? "" : "s"}
                    {c.can_mark_attendance &&
                      (c.attendance_marked_today ? (
                        <span className="text-emerald-600">· register marked</span>
                      ) : (
                        <span className="text-amber-600">· register pending</span>
                      ))}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {classes.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                You have no class assignments yet — ask your school admin to assign you to a class.
              </CardContent>
            </Card>
          )}
        </div>
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
