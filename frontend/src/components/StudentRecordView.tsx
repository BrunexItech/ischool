"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Award, BarChart3, Bus, CalendarClock, CheckCircle2, Circle, ClipboardList, Clock, CreditCard, ExternalLink, FileText, LayoutGrid, LogIn, LogOut, MapPin, NotebookPen, PlayCircle, ShieldCheck, Smartphone, Trophy, Upload, UserCheck, UtensilsCrossed, Video, Wallet, XCircle, type LucideIcon } from "lucide-react";
import {
  api,
  ApiError,
  Award as AwardRow,
  AttendanceRecord,
  ConductCategory,
  ConductReport,
  ExamForStudentListItem,
  FeeInvoice,
  HomeworkForStudent,
  LiveClass,
  MealMenuEntry,
  PaymentMethods,
  PickupDropoffLog,
  PaymentTransaction,
  Result,
  Student,
  StudentActivity,
  StudentTransport,
  TimetableSlot,
  Trip,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChildAvatar, Empty, Pill, Section, dueWords, longDay, money, scoreTone, shortDay } from "@/components/family/FamilyUi";
import { Ring, compactKes, healthTone } from "@/components/group/GroupUi";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const CONDUCT_CATEGORY_LABEL: Record<ConductCategory, string> = {
  disruption: "Disruption",
  disrespect: "Disrespect",
  bullying: "Bullying",
  fighting: "Fighting",
  dishonesty: "Dishonesty / Cheating",
  property_damage: "Property damage",
  dress_code: "Dress code",
  other: "Other",
};

const HOMEWORK_STATUS_STYLE: Record<string, { variant: "default" | "secondary" | "outline"; label: string; icon: typeof CheckCircle2 }> = {
  not_submitted: { variant: "outline", label: "Not submitted", icon: Circle },
  submitted: { variant: "secondary", label: "Submitted", icon: Clock },
  reviewed: { variant: "default", label: "Reviewed", icon: CheckCircle2 },
};

function SubmitHomeworkDialog({ studentId, homework, onSubmitted }: { studentId: number; homework: HomeworkForStudent; onSubmitted: (hw: HomeworkForStudent) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token || !file) return;
    setSubmitting(true);
    try {
      const updated = await api.submitChildHomework(token, studentId, homework.id, file);
      onSubmitted(updated);
      setOpen(false);
      setFile(null);
      toast.success("Homework submitted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to submit homework");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-10 gap-1.5"><Upload /> {homework.status === "not_submitted" ? "Submit" : "Resubmit"}</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Submit: {homework.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Upload a clear photo of the completed work.</p>
        <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button onClick={handleSubmit} disabled={submitting || !file}>
          {submitting ? "Uploading..." : "Submit"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function PayWithMpesaDialog({ studentId, invoice, onPaid }: { studentId: number; invoice: FeeInvoice; onPaid: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => stopPolling, []);

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const tx = await api.payInvoiceWithMpesa(token, studentId, invoice.id, { phone_number: phone });
      setTransaction(tx);
      pollRef.current = setInterval(async () => {
        const updated = await api.checkMpesaPaymentStatus(token, studentId, invoice.id, tx.id);
        setTransaction(updated);
        if (updated.status !== "pending") {
          stopPolling();
          if (updated.status === "completed") {
            toast.success("Payment received — thank you!");
            onPaid();
          }
        }
      }, 3000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to start M-Pesa payment");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      stopPolling();
      setTransaction(null);
      setPhone("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button className="h-10 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"><Smartphone /> Pay with M-Pesa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {invoice.term} balance</DialogTitle>
        </DialogHeader>

        {!transaction && (
          <form onSubmit={handleInitiate} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Balance: KES {invoice.balance.toLocaleString()}. You&apos;ll get an M-Pesa prompt on your phone.
            </p>
            <div className="grid gap-1.5">
              <Label>M-Pesa phone number</Label>
              <Input required placeholder="0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Sending prompt..." : "Send M-Pesa prompt"}
            </Button>
          </form>
        )}

        {transaction?.status === "pending" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Spinner size={28} />
            <p className="text-sm text-muted-foreground">Enter your M-Pesa PIN on your phone to complete the payment...</p>
          </div>
        )}
        {transaction?.status === "completed" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="size-8 text-emerald-600" />
            <p className="text-sm font-medium">Payment received</p>
          </div>
        )}
        {transaction?.status === "failed" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">The payment didn&apos;t go through. You can try again.</p>
            <Button variant="outline" size="sm" onClick={() => setTransaction(null)}>Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayWithCardButton({ studentId, invoice }: { studentId: number; invoice: FeeInvoice }) {
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (!token) return;
    setSubmitting(true);
    try {
      const { checkout_url } = await api.payInvoiceWithCard(token, studentId, invoice.id, {});
      window.location.href = checkout_url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to start card payment");
      setSubmitting(false);
    }
  }

  return (
    <Button className="h-10 gap-1.5" variant="outline" onClick={handleClick} disabled={submitting}>
      {submitting ? <Spinner size={16} className="text-current" /> : <CreditCard />} {submitting ? "Redirecting..." : "Pay with Card"}
    </Button>
  );
}

type SectionId =
  | "overview" | "timetable" | "homework" | "exams" | "results" | "live-classes"
  | "attendance" | "meals" | "transport" | "pickup" | "activities" | "trips"
  | "fees" | "awards" | "conduct";

const NAV: { label: string; items: { id: SectionId; label: string; icon: LucideIcon; parentOnly?: boolean }[] }[] = [
  { label: "", items: [{ id: "overview", label: "Overview", icon: LayoutGrid }] },
  { label: "Learning", items: [
    { id: "timetable", label: "Timetable", icon: CalendarClock },
    { id: "homework", label: "Homework", icon: NotebookPen },
    { id: "exams", label: "Exams", icon: ClipboardList },
    { id: "results", label: "Results", icon: BarChart3 },
    { id: "live-classes", label: "Live classes", icon: Video },
  ] },
  { label: "Daily life", items: [
    { id: "attendance", label: "Attendance", icon: UserCheck },
    { id: "meals", label: "Meals", icon: UtensilsCrossed },
    { id: "transport", label: "Transport", icon: Bus },
    { id: "pickup", label: "Pickup and drop-off", icon: LogOut, parentOnly: true },
    { id: "activities", label: "Activities", icon: Trophy },
    { id: "trips", label: "Trips", icon: MapPin },
  ] },
  { label: "Money", items: [{ id: "fees", label: "Fees", icon: Wallet }] },
  { label: "Character", items: [
    { id: "awards", label: "Awards", icon: Award },
    { id: "conduct", label: "Conduct", icon: ShieldCheck },
  ] },
];

const SECTION_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

function Card2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border bg-card p-4 shadow-xs sm:p-5 ${className}`}>{children}</div>;
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl border bg-card p-4 shadow-xs">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={`font-heading text-2xl leading-tight font-semibold tabular-nums ${tone}`}>{value}</span>
      {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const tone = scoreTone(score);
  const bar = tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${score} out of 100`}>
      <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(2, score))}%` }} />
    </span>
  );
}

export function StudentRecordView({ studentId, student, index = 0, switcher }: { studentId: number; student?: Student | null; index?: number; switcher?: ReactNode }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [transport, setTransport] = useState<StudentTransport | null>(null);
  const [mealMenu, setMealMenu] = useState<MealMenuEntry[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [exams, setExams] = useState<ExamForStudentListItem[]>([]);
  const [homework, setHomework] = useState<HomeworkForStudent[]>([]);
  const [studentActivities, setStudentActivities] = useState<StudentActivity[]>([]);
  const [pickupDropoff, setPickupDropoff] = useState<PickupDropoffLog[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [conductReports, setConductReports] = useState<ConductReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingEvent, setReportingEvent] = useState<"pickup" | "dropoff" | null>(null);
  const [now] = useState(() => new Date());
  const [hwFilter, setHwFilter] = useState<"todo" | "done" | "all">("todo");
  const todayIso = now.toLocaleDateString("en-CA");
  const [day, setDay] = useState(() => Math.min(4, (now.getDay() + 6) % 7));
  const isParent = user?.role === "parent";
  const isStudent = user?.role === "student";

  function refreshFees() {
    if (!token) return;
    api.getChildFees(token, studentId).then(setInvoices).catch(() => setInvoices([]));
  }

  async function reportPickupDropoff(eventType: "pickup" | "dropoff") {
    if (!token) return;
    setReportingEvent(eventType);
    try {
      const created = await api.reportPickupDropoff(token, studentId, eventType);
      setPickupDropoff((all) => [created, ...all]);
      toast.success(eventType === "pickup" ? "Pickup confirmed" : "Drop-off confirmed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to report");
    } finally {
      setReportingEvent(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.getChildAttendance(token, studentId).then(setAttendance).catch(() => setAttendance([])),
      api.getChildResults(token, studentId).then(setResults).catch(() => setResults([])),
      api.getChildFees(token, studentId).then(setInvoices).catch(() => setInvoices([])),
      api.getChildTransport(token, studentId).then(setTransport).catch(() => setTransport(null)),
      api.getChildMealMenu(token, studentId).then(setMealMenu).catch(() => setMealMenu([])),
      api.getChildAwards(token, studentId).then(setAwards).catch(() => setAwards([])),
      api.getChildExams(token, studentId).then(setExams).catch(() => setExams([])),
      api.getChildHomework(token, studentId).then(setHomework).catch(() => setHomework([])),
      api.getChildActivities(token, studentId).then(setStudentActivities).catch(() => setStudentActivities([])),
      api.getChildPickupDropoff(token, studentId).then(setPickupDropoff).catch(() => setPickupDropoff([])),
      api.getChildPaymentMethods(token, studentId).then(setPaymentMethods).catch(() => setPaymentMethods(null)),
      api.getChildTimetable(token, studentId).then(setTimetable).catch(() => setTimetable([])),
      api.getChildLiveClasses(token, studentId).then(setLiveClasses).catch(() => setLiveClasses([])),
      api.getChildTrips(token, studentId).then(setTrips).catch(() => setTrips([])),
      user?.school_id
        ? api.listConductReports(token, user.school_id, studentId).then(setConductReports).catch(() => setConductReports([]))
        : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [token, studentId, user?.school_id]);

  const requested = search.get("tab") as SectionId | null;
  const section: SectionId = requested && SECTION_IDS.includes(requested) && !(requested === "pickup" && !isParent) ? requested : "overview";
  const go = (id: SectionId) => router.replace(id === "overview" ? pathname : `${pathname}?tab=${id}`, { scroll: false });

  const stats = useMemo(() => {
    const since = new Date(now);
    since.setDate(since.getDate() - 30);
    const recent = attendance.filter((r) => new Date(r.date + "T12:00:00") >= since);
    const here = recent.filter((r) => r.status === "present" || r.status === "late").length;
    const rate = recent.length ? Math.round((here / recent.length) * 100) : null;
    const owed = invoices.reduce((n, i) => n + (i.balance > 0 ? i.balance : 0), 0);
    const billed = invoices.reduce((n, i) => n + i.amount_due, 0);
    const paid = invoices.reduce((n, i) => n + i.amount_paid, 0);
    const todo = homework.filter((h) => h.status === "not_submitted");
    const late = todo.filter((h) => h.due_date < todayIso);
    const terms = [...new Set(results.map((r) => r.term))];
    const latestTerm = terms[terms.length - 1];
    const latest = results.filter((r) => r.term === latestTerm);
    const avg = latest.length ? Math.round(latest.reduce((n, r) => n + r.score, 0) / latest.length) : null;
    return { rate, owed, billed, paid, todo, late, latestTerm, latest, avg, openConduct: conductReports.filter((c) => c.status !== "reviewed").length };
  }, [attendance, invoices, homework, results, conductReports, now, todayIso]);

  if (loading) return <PageLoader label="Opening the record..." />;

  const badge = (id: SectionId): ReactNode => {
    if (id === "homework" && stats.todo.length) return <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${stats.late.length ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>{stats.todo.length}</span>;
    if (id === "fees" && stats.owed > 0) return <span className="ml-auto size-2 rounded-full bg-amber-500" aria-label="Balance due" />;
    if (id === "conduct" && stats.openConduct) return <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{stats.openConduct}</span>;
    return null;
  };

  const name = student ? `${student.first_name} ${student.last_name}` : "";
  const todaySlots = timetable.filter((s) => s.day_of_week === (now.getDay() + 6) % 7).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const lessonRow = (s: TimetableSlot) => (
    <div key={s.id} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3">
      <div className="w-[4.5rem] shrink-0 text-xs tabular-nums leading-tight text-muted-foreground"><span className="block font-semibold text-foreground">{s.start_time.slice(0, 5)}</span>{s.end_time.slice(0, 5)}</div>
      <div className="min-w-0"><p className="truncate font-medium">{s.subject_name}</p><p className="truncate text-xs text-muted-foreground">{s.teacher_name ?? "Teacher to be confirmed"}{s.room ? ` · ${s.room}` : ""}</p></div>
    </div>
  );

  const content: Record<SectionId, ReactNode> = {
    overview: (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Attendance (30 days)" value={stats.rate != null ? `${stats.rate}%` : "—"} sub={stats.rate == null ? "Nothing recorded yet" : stats.rate >= 90 ? "Excellent" : stats.rate >= 75 ? "Fair" : "Needs attention"} tone={healthTone(stats.rate).text} />
          <Stat label="Fee balance" value={stats.owed > 0 ? money(stats.owed) : "Paid up"} sub={stats.billed ? `${money(stats.paid)} of ${money(stats.billed)} paid` : "No invoices yet"} tone={stats.owed > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"} />
          <Stat label="Homework to do" value={stats.todo.length} sub={stats.late.length ? `${stats.late.length} late` : "None late"} tone={stats.late.length ? "text-red-600" : ""} />
          <Stat label={stats.latestTerm ? `Average, ${stats.latestTerm}` : "Average score"} value={stats.avg != null ? `${stats.avg}%` : "—"} sub={stats.latest.length ? `${stats.latest.length} subjects` : "No results yet"} />
        </div>
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Section title="Today's lessons" hint={longDay(todayIso)} action={<Button variant="ghost" size="sm" className="h-9" onClick={() => go("timetable")}>Timetable</Button>}>
            {todaySlots.length === 0 ? <Empty icon={<CalendarClock />} title="No lessons today">Nothing is on the timetable for today.</Empty> : <div className="flex flex-col gap-2">{todaySlots.map(lessonRow)}</div>}
          </Section>
          <Section title="Homework to hand in" action={<Button variant="ghost" size="sm" className="h-9" onClick={() => go("homework")}>All homework</Button>}>
            {stats.todo.length === 0 ? <Empty icon={<CheckCircle2 />} title="All handed in">No homework is waiting.</Empty> : (
              <div className="flex flex-col gap-2">
                {stats.todo.slice(0, 4).map((h) => (
                  <button key={h.id} type="button" onClick={() => go("homework")} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/50">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{h.title}</p><p className="truncate text-xs text-muted-foreground">{h.subject_name}</p></div>
                    <Pill tone={h.due_date < todayIso ? "bad" : "info"}>{dueWords(todayIso, h.due_date)}</Pill>
                  </button>
                ))}
              </div>
            )}
          </Section>
          <Section title="Latest results" action={<Button variant="ghost" size="sm" className="h-9" onClick={() => go("results")}>All results</Button>}>
            {stats.latest.length === 0 ? <Empty icon={<BarChart3 />} title="No results yet">Marks appear here as teachers enter them.</Empty> : (
              <Card2 className="flex flex-col gap-3">
                {stats.latest.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm font-medium sm:w-36">{r.subject_name ?? "Subject"}</span>
                    <ScoreBar score={r.score} />
                    <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums">{r.score}</span>
                  </div>
                ))}
              </Card2>
            )}
          </Section>
          <Section title="Recognition" action={<Button variant="ghost" size="sm" className="h-9" onClick={() => go("awards")}>All awards</Button>}>
            {awards.length === 0 ? <Empty icon={<Award />} title="No awards yet">Awards and recognition will show here.</Empty> : (
              <div className="flex flex-col gap-2">
                {awards.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Award className="size-4.5" /></span>
                    <div className="min-w-0"><p className="truncate font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{shortDay(a.date_awarded.slice(0, 10))}</p></div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    ),

    timetable: (
      <div className="flex flex-col gap-4">
        {timetable.length === 0 ? <Empty icon={<CalendarClock />} title="No timetable yet">The timetable for this class has not been published.</Empty> : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden" role="tablist" aria-label="Day of the week">
              {DAYS.slice(0, 6).map((d, i) => timetable.some((s) => s.day_of_week === i) || i < 5 ? (
                <button key={d} type="button" role="tab" aria-selected={day === i} onClick={() => setDay(i)} className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${day === i ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>{d.slice(0, 3)}{i === (now.getDay() + 6) % 7 ? " · today" : ""}</button>
              ) : null)}
            </div>
            <div className="flex flex-col gap-2 lg:hidden">
              {timetable.filter((s) => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time)).map(lessonRow)}
              {timetable.filter((s) => s.day_of_week === day).length === 0 && <Empty icon={<CalendarClock />} title="No lessons this day" />}
            </div>
            <div className="hidden gap-3 lg:grid lg:grid-cols-5">
              {DAYS.slice(0, 5).map((d, i) => (
                <div key={d} className={`flex min-w-0 flex-col gap-2 rounded-2xl border p-3 ${i === (now.getDay() + 6) % 7 ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
                  <p className="text-sm font-semibold">{d}{i === (now.getDay() + 6) % 7 && <span className="ml-1.5 text-xs font-medium text-primary">Today</span>}</p>
                  {timetable.filter((s) => s.day_of_week === i).sort((a, b) => a.start_time.localeCompare(b.start_time)).map((s) => (
                    <div key={s.id} className="rounded-lg border bg-background p-2 text-xs"><p className="font-medium text-sm">{s.subject_name}</p><p className="text-muted-foreground tabular-nums">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</p><p className="truncate text-muted-foreground">{s.teacher_name ?? ""}</p></div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    ),

    homework: (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Homework filter">
          {([["todo", `To do (${stats.todo.length})`], ["done", "Handed in"], ["all", "All"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={hwFilter === k} onClick={() => setHwFilter(k)} className={`h-10 rounded-full border px-4 text-sm font-medium transition-colors ${hwFilter === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>{l}</button>
          ))}
        </div>
        {(() => {
          const shown = homework.filter((h) => hwFilter === "all" || (hwFilter === "todo" ? h.status === "not_submitted" : h.status !== "not_submitted"));
          if (shown.length === 0) return <Empty icon={<NotebookPen />} title={hwFilter === "todo" ? "Nothing to do" : "Nothing here yet"}>{hwFilter === "todo" ? "All homework has been handed in." : "Homework will appear here."}</Empty>;
          return shown.map((hw) => {
            const style = HOMEWORK_STATUS_STYLE[hw.status];
            const Icon = style.icon;
            const late = hw.status === "not_submitted" && hw.due_date < todayIso;
            return (
              <Card2 key={hw.id} className={`flex flex-col gap-3 ${late ? "border-red-200 dark:border-red-500/30" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><Pill tone="quiet">{hw.subject_name}</Pill><p className="mt-1.5 font-heading text-base font-semibold break-words">{hw.title}</p></div>
                  <div className="flex flex-col items-end gap-1"><Badge variant={style.variant} className="gap-1"><Icon className="size-3" /> {style.label}</Badge><span className={`text-xs font-medium ${late ? "text-red-600" : "text-muted-foreground"}`}>{dueWords(todayIso, hw.due_date)}</span></div>
                </div>
                {hw.instructions && <p className="text-sm whitespace-pre-line text-muted-foreground">{hw.instructions}</p>}
                {hw.teacher_comment && <div className="rounded-lg bg-muted/50 p-2.5 text-sm"><span className="text-xs font-medium text-muted-foreground">Teacher&apos;s comment</span><p>{hw.teacher_comment}</p></div>}
                <div className="flex flex-wrap items-center gap-2">
                  {hw.score != null && <Pill tone="good">Score {hw.score}</Pill>}
                  {hw.attachment_url && <Button variant="outline" size="sm" className="h-10 gap-1.5" render={<a href={hw.attachment_url} target="_blank" rel="noreferrer"><FileText /> Worksheet</a>} nativeButton={false} />}
                  {hw.file_url && <Button variant="outline" size="sm" className="h-10 gap-1.5" render={<a href={hw.file_url} target="_blank" rel="noreferrer"><ExternalLink /> My submission</a>} nativeButton={false} />}
                  {isStudent && hw.allow_digital_submission && hw.status !== "reviewed" && (
                    <SubmitHomeworkDialog studentId={studentId} homework={hw} onSubmitted={(updated) => setHomework((h) => h.map((x) => (x.id === updated.id ? updated : x)))} />
                  )}
                </div>
              </Card2>
            );
          });
        })()}
      </div>
    ),

    exams: (
      <div className="flex flex-col gap-3">
        {exams.length === 0 ? <Empty icon={<ClipboardList />} title="No exams yet">Exams that are set will appear here.</Empty> : exams.map((e) => {
          const opensLater = e.opens_at && new Date(e.opens_at) > now;
          const closed = e.closes_at && new Date(e.closes_at) < now && e.submission_status === null;
          return (
            <Card2 key={e.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Pill tone="quiet">{e.subject_name}</Pill>
                <p className="mt-1.5 font-heading text-base font-semibold break-words">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.term} · {e.duration_minutes} min · {e.total_marks} marks{opensLater ? ` · opens ${new Date(e.opens_at!).toLocaleString()}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={e.submission_status === "graded" ? "default" : "secondary"} className="capitalize">{e.submission_status?.replace("_", " ") ?? (closed ? "Closed" : "Not started")}</Badge>
                {e.score !== null && <span className="font-heading text-lg font-semibold tabular-nums">{e.score}/{e.total_marks}</span>}
                {isStudent && (e.paper_file_url
                  ? <Button className="h-10" variant="outline" render={<a href={e.paper_file_url} target="_blank" rel="noreferrer">Download paper</a>} nativeButton={false} />
                  : !opensLater && !closed && (e.submission_status === null || e.submission_status === "in_progress") && <Button className="h-10 gap-1.5" render={<Link href={`/dashboard/take-exam/${e.id}`}><PlayCircle /> {e.submission_status === "in_progress" ? "Continue" : "Start exam"}</Link>} nativeButton={false} />)}
              </div>
            </Card2>
          );
        })}
      </div>
    ),

    results: (
      <div className="flex flex-col gap-5">
        {results.length === 0 ? <Empty icon={<BarChart3 />} title="No results yet">Marks appear here as teachers enter them.</Empty> : (
          <>
            <div className="flex justify-end"><Button className="h-10 gap-1.5" render={<Link href={`/dashboard/report-card/${studentId}`}><FileText /> View full report card</Link>} nativeButton={false} /></div>
            {[...new Set(results.map((r) => r.term))].reverse().map((term) => {
              const rows = results.filter((r) => r.term === term);
              const avg = Math.round(rows.reduce((n, r) => n + r.score, 0) / rows.length);
              return (
                <Section key={term} title={term} hint={`${rows.length} ${rows.length === 1 ? "mark" : "marks"}`} action={<Pill tone={scoreTone(avg)}>Average {avg}%</Pill>}>
                  <Card2 className="flex flex-col divide-y p-0 sm:p-0">
                    {rows.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:px-5">
                        <div className="min-w-0 flex-1 basis-40"><p className="truncate font-medium">{r.subject_name ?? "Subject"}</p><p className="truncate text-xs text-muted-foreground">{r.exam_type}{r.remarks ? ` · ${r.remarks}` : ""}</p></div>
                        <div className="flex w-full items-center gap-3 sm:w-64"><ScoreBar score={r.score} /><span className="w-9 shrink-0 text-right font-semibold tabular-nums">{r.score}</span></div>
                        <Badge variant="secondary" className="w-10 justify-center">{r.grade ?? "—"}</Badge>
                      </div>
                    ))}
                  </Card2>
                </Section>
              );
            })}
          </>
        )}
      </div>
    ),

    "live-classes": (
      <div className="flex flex-col gap-3">
        {liveClasses.length === 0 ? <Empty icon={<Video />} title="No online classes">Live lessons will appear here when they are scheduled.</Empty> : liveClasses.map((lc) => (
          <Card2 key={lc.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><p className="font-heading text-base font-semibold">{lc.title}</p><p className="text-xs text-muted-foreground">{new Date(lc.scheduled_start).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
            <div className="flex items-center gap-2">
              <Pill tone={lc.status === "live" ? "good" : lc.status === "ended" ? "quiet" : "info"}>{lc.status === "live" ? "Live now" : lc.status}</Pill>
              {isStudent && lc.status !== "ended" && <Button className="h-10 gap-1.5" onClick={() => router.push(`/live-classes/${lc.id}/room`)}><Video /> Join class</Button>}
            </div>
          </Card2>
        ))}
      </div>
    ),

    attendance: (() => {
      const counts = { present: 0, absent: 0, late: 0, excused: 0 } as Record<string, number>;
      attendance.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
      const total = attendance.length;
      const rate = total ? Math.round(((counts.present + counts.late) / total) * 100) : null;
      const months = [...new Set(attendance.map((r) => r.date.slice(0, 7)))].sort().reverse();
      const chip: Record<string, string> = { present: "bg-emerald-500 text-white", absent: "bg-red-500 text-white", late: "bg-amber-400 text-amber-950", excused: "bg-sky-400 text-sky-950" };
      return (
        <div className="flex flex-col gap-5">
          {total === 0 ? <Empty icon={<UserCheck />} title="No attendance yet">Registers appear here once the teacher has taken them.</Empty> : (
            <>
              <Card2 className="flex flex-wrap items-center gap-5">
                <Ring value={rate} size={92} stroke={10} label="Attendance"><span className={`font-heading text-xl font-semibold ${healthTone(rate).text}`}>{rate}%</span><span className="text-[10px] text-muted-foreground">present</span></Ring>
                <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                  {([["present", "Present", "bg-emerald-500"], ["late", "Late", "bg-amber-400"], ["absent", "Absent", "bg-red-500"], ["excused", "Excused", "bg-sky-400"]] as const).map(([k, l, c]) => (
                    <div key={k} className="flex items-center gap-2.5"><span className={`size-3 rounded-full ${c}`} aria-hidden /><div><p className="font-heading text-xl leading-none font-semibold tabular-nums">{counts[k]}</p><p className="text-xs text-muted-foreground">{l}</p></div></div>
                  ))}
                </div>
              </Card2>
              {months.map((m) => {
                const rows = attendance.filter((r) => r.date.startsWith(m)).sort((a, b) => a.date.localeCompare(b.date));
                return (
                  <Section key={m} title={new Date(m + "-15T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}>
                    <Card2>
                      <div className="flex flex-wrap gap-2">
                        {rows.map((r) => (
                          <span key={r.id} title={`${shortDay(r.date)}: ${r.status}${r.reason ? ` (${r.reason})` : ""}`} className={`flex size-10 flex-col items-center justify-center rounded-xl text-center leading-none ${chip[r.status]}`}>
                            <span className="text-[9px] font-medium uppercase opacity-80">{new Date(r.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</span>
                            <span className="text-sm font-semibold">{new Date(r.date + "T12:00:00").getDate()}</span>
                          </span>
                        ))}
                      </div>
                      {rows.some((r) => r.status !== "present") && (
                        <ul className="mt-4 flex flex-col gap-1.5 border-t pt-3 text-sm">
                          {rows.filter((r) => r.status !== "present").map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center gap-2"><span className="w-24 text-muted-foreground">{shortDay(r.date)}</span><Pill tone={r.status === "absent" ? "bad" : r.status === "late" ? "warn" : "info"}><span className="capitalize">{r.status}</span></Pill>{r.reason && <span className="text-muted-foreground">{r.reason}</span>}</li>
                          ))}
                        </ul>
                      )}
                    </Card2>
                  </Section>
                );
              })}
            </>
          )}
        </div>
      );
    })(),

    meals: (
      <div className="flex flex-col gap-4">
        {mealMenu.length === 0 ? <Empty icon={<UtensilsCrossed />} title="No menu yet">The meal menu will appear here once the school publishes it.</Empty> : [...new Set(mealMenu.map((m) => m.date))].sort().map((d) => (
          <Card2 key={d} className="flex flex-col gap-3">
            <p className="font-heading font-semibold">{longDay(d.slice(0, 10))}{d.slice(0, 10) === todayIso && <span className="ml-2 text-xs font-medium text-primary">Today</span>}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {mealMenu.filter((m) => m.date === d).map((m) => (
                <div key={m.id} className="rounded-xl bg-muted/40 p-3"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{m.meal_type}</p><p className="text-sm">{m.description}</p></div>
              ))}
            </div>
          </Card2>
        ))}
      </div>
    ),

    transport: transport?.assigned ? (
      <Card2 className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        {([["Route", transport.route_name], ["Stop", transport.stop_name], ["Pickup time", transport.pickup_time], ["Vehicle", transport.vehicle_registration], ["Driver", transport.driver_name], ["Driver phone", transport.driver_phone]] as const).map(([l, v]) => (
          <div key={l} className="min-w-0"><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium break-words">{v ?? "—"}</p></div>
        ))}
      </Card2>
    ) : <Empty icon={<Bus />} title="Not on a school bus">This learner is not assigned to a transport route.</Empty>,

    pickup: (
      <div className="flex flex-col gap-4">
        {isParent && (
          <div className="flex flex-wrap gap-3 rounded-2xl border bg-muted/30 p-4">
            <Button size="lg" disabled={reportingEvent !== null} onClick={() => reportPickupDropoff("pickup")} className="h-12 flex-1 gap-2 sm:flex-none">
              {reportingEvent === "pickup" ? <Spinner size={16} className="text-current" /> : <LogOut />} I&apos;m picking up now
            </Button>
            <Button size="lg" variant="outline" disabled={reportingEvent !== null} onClick={() => reportPickupDropoff("dropoff")} className="h-12 flex-1 gap-2 sm:flex-none">
              {reportingEvent === "dropoff" ? <Spinner size={16} className="text-current" /> : <LogIn />} I&apos;ve dropped off now
            </Button>
          </div>
        )}
        {pickupDropoff.length === 0 ? <Empty icon={<LogOut />} title="No records yet">Pickups and drop-offs will be listed here.</Empty> : (
          <Card2 className="flex flex-col divide-y p-0 sm:p-0">
            {pickupDropoff.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
                <Pill tone={p.event_type === "pickup" ? "info" : "good"}>{p.event_type === "pickup" ? "Picked up" : "Dropped off"}</Pill>
                <span className="text-sm font-medium">{p.person_name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{new Date(p.occurred_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                {p.notes && <span className="w-full text-xs text-muted-foreground">{p.notes}</span>}
              </div>
            ))}
          </Card2>
        )}
      </div>
    ),

    activities: (
      <div className="grid gap-3 sm:grid-cols-2">
        {studentActivities.length === 0 ? <div className="sm:col-span-2"><Empty icon={<Trophy />} title="No activities yet">Clubs, sports and events will be listed here.</Empty></div> : studentActivities.map((a) => (
          <Card2 key={`${a.activity_id}-${a.date}`} className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Trophy className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{a.activity_name}</p><p className="text-xs text-muted-foreground">{shortDay(a.date.slice(0, 10))}{a.role ? ` · ${a.role}` : ""}</p></div>
            {a.category && <Pill tone="quiet"><span className="capitalize">{a.category}</span></Pill>}
          </Card2>
        ))}
      </div>
    ),

    trips: (
      <div className="flex flex-col gap-3">
        {trips.length === 0 ? <Empty icon={<MapPin />} title="No trips">School trips this learner is part of will show here.</Empty> : trips.map((t) => (
          <Card2 key={t.id} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-heading text-base font-semibold">{t.title}</p><Pill tone={t.status === "cancelled" || t.status === "declined" ? "bad" : "info"}><span className="capitalize">{t.status.replace("_", " ")}</span></Pill></div>
            <p className="text-sm text-muted-foreground">{t.destination} · {shortDay(t.start_date)} to {shortDay(t.end_date)}</p>
            <p className="text-sm">{t.purpose}</p>
          </Card2>
        ))}
      </div>
    ),

    fees: (
      <div className="flex flex-col gap-4">
        <Card2 className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 text-center sm:text-left">
            <div><p className="text-xs text-muted-foreground">Billed</p><p className="font-heading text-lg font-semibold tabular-nums">{money(stats.billed)}</p></div>
            <div><p className="text-xs text-muted-foreground">Paid</p><p className="font-heading text-lg font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">{money(stats.paid)}</p></div>
            <div><p className="text-xs text-muted-foreground">Balance</p><p className={`font-heading text-lg font-semibold tabular-nums ${stats.owed > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>{money(stats.owed)}</p></div>
          </div>
          <span className="block h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${stats.billed ? Math.round((stats.paid / stats.billed) * 100) : 0}% paid`}><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${stats.billed ? Math.min(100, (stats.paid / stats.billed) * 100) : 0}%` }} /></span>
        </Card2>
        {invoices.length === 0 ? <Empty icon={<Wallet />} title="No invoices yet">Fee invoices will appear here when the school issues them.</Empty> : invoices.map((inv) => (
          <Card2 key={inv.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-heading text-base font-semibold">{inv.term}</p><p className="text-xs text-muted-foreground capitalize">{inv.category}{inv.due_date ? ` · due ${shortDay(inv.due_date)}` : ""}</p></div>
              <Pill tone={inv.status === "paid" ? "good" : inv.status === "partial" ? "warn" : "bad"}><span className="capitalize">{inv.status === "unpaid" ? "Not paid" : inv.status}</span></Pill>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="text-sm text-muted-foreground">{money(inv.amount_paid)} paid of {money(inv.amount_due)}<p className={`font-heading text-xl font-semibold tabular-nums ${inv.balance > 0 ? "text-foreground" : "text-emerald-700"}`}>{inv.balance > 0 ? `${money(inv.balance)} to pay` : "Fully paid"}</p></div>
              {inv.status !== "paid" && (
                <div className="flex flex-wrap gap-2">
                  {paymentMethods?.mpesa && <PayWithMpesaDialog studentId={studentId} invoice={inv} onPaid={refreshFees} />}
                  {paymentMethods?.card && <PayWithCardButton studentId={studentId} invoice={inv} />}
                  {paymentMethods && !paymentMethods.mpesa && !paymentMethods.card && <span className="text-xs text-muted-foreground">Pay at the school bursar&apos;s office.</span>}
                </div>
              )}
            </div>
          </Card2>
        ))}
      </div>
    ),

    awards: (
      <div className="grid gap-3 sm:grid-cols-2">
        {awards.length === 0 ? <div className="sm:col-span-2"><Empty icon={<Award />} title="No awards yet">Awards and recognition will show here.</Empty></div> : awards.map((a) => (
          <Card2 key={a.id} className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Award className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-medium break-words">{a.title}</p><p className="text-xs text-muted-foreground">{shortDay(a.date_awarded.slice(0, 10))}</p></div>
            {a.category && <Pill tone="quiet"><span className="capitalize">{a.category}</span></Pill>}
          </Card2>
        ))}
      </div>
    ),

    conduct: (
      <div className="flex flex-col gap-3">
        {conductReports.length === 0 ? <Empty icon={<ShieldCheck />} title="Nothing on file">No conduct reports have been filed.</Empty> : conductReports.map((r) => (
          <Card2 key={r.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{CONDUCT_CATEGORY_LABEL[r.category]}</Badge>
              <Badge variant={r.status === "reviewed" ? "secondary" : "outline"}>{r.status === "reviewed" ? "Reviewed" : "Open"}</Badge>
              <span className="text-xs text-muted-foreground">{shortDay(r.incident_date)} · Filed by {r.reported_by_name}</span>
            </div>
            <p className="text-sm">{r.description}</p>
            {r.action_taken && <p className="text-sm text-muted-foreground">Action taken: {r.action_taken}</p>}
            {r.response && <div className="rounded-lg border bg-muted/40 p-2.5 text-sm"><p className="text-xs font-medium text-muted-foreground">Leadership response</p><p>{r.response}</p></div>}
          </Card2>
        ))}
      </div>
    ),
  };

  const active = NAV.flatMap((g) => g.items).find((i) => i.id === section)!;

  return (
    <div className="flex flex-col gap-5">
      {student && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5e1012] via-[#A71C20] to-[#D9531E] p-5 text-white shadow-md sm:p-6">
          <div className="pointer-events-none absolute -top-16 -right-10 size-52 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="relative flex flex-wrap items-center gap-4">
            <ChildAvatar first={student.first_name} last={student.last_name} index={index} size={64} />
            <div className="min-w-0 flex-1 basis-56">
              <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight break-words">{name}</h1>
              <p className="mt-0.5 text-sm text-white/85">{student.class_name ?? "No class yet"} · Admission {student.admission_number}{student.upi_number ? ` · UPI ${student.upi_number}` : ""}</p>
            </div>
            <div className="flex gap-2.5">
              <div className="rounded-2xl bg-white/15 px-3.5 py-2 text-center backdrop-blur-sm"><p className="font-heading text-lg leading-tight font-semibold tabular-nums">{stats.rate != null ? `${stats.rate}%` : "—"}</p><p className="text-[10px] tracking-wide text-white/75 uppercase">Attendance</p></div>
              <div className="rounded-2xl bg-white/15 px-3.5 py-2 text-center backdrop-blur-sm"><p className="font-heading text-lg leading-tight font-semibold tabular-nums">{stats.todo.length}</p><p className="text-[10px] tracking-wide text-white/75 uppercase">Homework</p></div>
              <div className="rounded-2xl bg-white/15 px-3.5 py-2 text-center backdrop-blur-sm"><p className="font-heading text-lg leading-tight font-semibold tabular-nums">{stats.owed > 0 ? compactKes(stats.owed).replace("KES ", "") : "Paid"}</p><p className="text-[10px] tracking-wide text-white/75 uppercase">Fees due</p></div>
            </div>
          </div>
          {switcher && <div className="relative mt-4 border-t border-white/20 pt-3">{switcher}</div>}
        </div>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-7">
        <nav aria-label="Sections" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
            {NAV.map((g) => {
              const items = g.items.filter((i) => !i.parentOnly || isParent);
              return (
                <div key={g.label || "top"} className="flex shrink-0 gap-2 lg:flex-col lg:gap-1">
                  {g.label && <p className="hidden px-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase lg:block">{g.label}</p>}
                  {items.map((i) => {
                    const on = i.id === section;
                    return (
                      <button key={i.id} type="button" aria-current={on ? "page" : undefined} onClick={() => go(i.id)} className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-xl ${on ? "bg-primary text-primary-foreground shadow-xs" : "border bg-card text-foreground/80 hover:bg-accent lg:border-transparent lg:bg-transparent"}`}>
                        <i.icon className="size-4 shrink-0" />
                        <span>{i.label}</span>
                        {badge(i.id)}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </nav>
        <div className="min-w-0">
          {section !== "overview" && <h2 className="mb-4 flex items-center gap-2 font-heading text-xl font-semibold tracking-tight"><active.icon className="size-5 text-primary" /> {active.label}</h2>}
          {content[section]}
        </div>
      </div>
    </div>
  );
}
