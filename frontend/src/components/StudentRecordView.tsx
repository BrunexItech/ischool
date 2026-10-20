"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock, CreditCard, ExternalLink, FileText, LogIn, LogOut, PlayCircle, Smartphone, Upload, Video, XCircle } from "lucide-react";
import {
  api,
  ApiError,
  Award,
  AttendanceRecord,
  ExamForStudentListItem,
  FeeInvoice,
  HomeworkForStudent,
  LiveClass,
  MealMenuEntry,
  PaymentMethods,
  PickupDropoffLog,
  PaymentTransaction,
  Result,
  StudentActivity,
  StudentTransport,
  TimetableSlot,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ATTENDANCE_STYLE: Record<string, string> = {
  present: "text-emerald-600",
  absent: "text-red-600",
  late: "text-amber-600",
  excused: "text-sky-600",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const FEE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  partial: "secondary",
  unpaid: "destructive",
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
      <DialogTrigger render={<Button size="sm"><Upload /> {homework.status === "not_submitted" ? "Submit" : "Resubmit"}</Button>} />
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
      <DialogTrigger render={<Button size="sm"><Smartphone /> Pay with M-Pesa</Button>} />
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
    <Button size="sm" variant="outline" onClick={handleClick} disabled={submitting}>
      {submitting ? <Spinner size={16} className="text-current" /> : <CreditCard />} {submitting ? "Redirecting..." : "Pay with Card"}
    </Button>
  );
}

export function StudentRecordView({ studentId }: { studentId: number }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [transport, setTransport] = useState<StudentTransport | null>(null);
  const [mealMenu, setMealMenu] = useState<MealMenuEntry[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [exams, setExams] = useState<ExamForStudentListItem[]>([]);
  const [homework, setHomework] = useState<HomeworkForStudent[]>([]);
  const [studentActivities, setStudentActivities] = useState<StudentActivity[]>([]);
  const [pickupDropoff, setPickupDropoff] = useState<PickupDropoffLog[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingEvent, setReportingEvent] = useState<"pickup" | "dropoff" | null>(null);

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
    ]).finally(() => setLoading(false));
  }, [token, studentId]);

  if (loading) return <PageLoader />;

  return (
    <Tabs defaultValue="attendance">
      <TabsList>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
        <TabsTrigger value="timetable">Timetable</TabsTrigger>
        <TabsTrigger value="live-classes">Live Classes</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="fees">Fees</TabsTrigger>
        <TabsTrigger value="transport">Transport</TabsTrigger>
        <TabsTrigger value="meals">Meals</TabsTrigger>
        <TabsTrigger value="awards">Awards</TabsTrigger>
        <TabsTrigger value="activities">Activities</TabsTrigger>
        <TabsTrigger value="exams">Exams</TabsTrigger>
        <TabsTrigger value="homework">Homework</TabsTrigger>
        <TabsTrigger value="pickup">Pickup/Drop-off</TabsTrigger>
      </TabsList>

      <TabsContent value="attendance" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell className={`capitalize ${ATTENDANCE_STYLE[r.status]}`}>{r.status}</TableCell>
                </TableRow>
              ))}
              {attendance.length === 0 && (
                <TableRow><TableCell colSpan={2} className="h-24 text-center text-muted-foreground">No attendance recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="timetable" className="mt-4">
        <Card>
          <CardContent className="pt-6">
            {timetable.length === 0 ? (
              <p className="text-sm text-muted-foreground">No timetable published for this class yet.</p>
            ) : (
              <div className="space-y-5">
                {DAYS.map((day, i) => {
                  const slots = timetable.filter((s) => s.day_of_week === i).sort((a, b) => a.start_time.localeCompare(b.start_time));
                  if (slots.length === 0) return null;
                  return (
                    <div key={day}>
                      <p className="mb-2 text-sm font-semibold">{day}</p>
                      <div className="space-y-1.5">
                        {slots.map((s) => (
                          <div key={s.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                            <div>
                              <p className="font-medium">{s.subject_name}</p>
                              <p className="text-xs text-muted-foreground">{s.teacher_name ?? "—"}{s.room ? ` · ${s.room}` : ""}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="live-classes" className="mt-4">
        <Card>
          <CardContent className="pt-6">
            {liveClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No online classes scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {liveClasses.map((lc) => (
                  <div key={lc.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{lc.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(lc.scheduled_start).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={lc.status === "live" ? "default" : "secondary"}>{lc.status}</Badge>
                      {user?.role === "student" && lc.status !== "ended" && (
                        <Button size="sm" onClick={() => router.push(`/live-classes/${lc.id}/room`)}>
                          <Video /> Join
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="results" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.term}</TableCell>
                  <TableCell>{r.score}</TableCell>
                  <TableCell><Badge variant="secondary">{r.grade}</Badge></TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No results recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
        {results.length > 0 && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" render={<Link href={`/dashboard/report-card/${studentId}`}><FileText /> View report card</Link>} />
          </div>
        )}
      </TabsContent>

      <TabsContent value="fees" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.term}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{inv.category}</Badge></TableCell>
                  <TableCell>KES {inv.balance.toLocaleString()}</TableCell>
                  <TableCell><Badge variant={FEE_STATUS_VARIANT[inv.status]} className="capitalize">{inv.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {inv.status !== "paid" && (
                      <div className="flex justify-end gap-2">
                        {paymentMethods?.mpesa && (
                          <PayWithMpesaDialog studentId={studentId} invoice={inv} onPaid={refreshFees} />
                        )}
                        {paymentMethods?.card && <PayWithCardButton studentId={studentId} invoice={inv} />}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="transport" className="mt-4">
        <Card>
          <CardContent className="pt-6">
            {transport?.assigned ? (
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div><p className="text-muted-foreground">Route</p><p className="font-medium">{transport.route_name}</p></div>
                <div><p className="text-muted-foreground">Stop</p><p className="font-medium">{transport.stop_name ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Pickup time</p><p className="font-medium">{transport.pickup_time ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Vehicle</p><p className="font-medium">{transport.vehicle_registration ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Driver</p><p className="font-medium">{transport.driver_name ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Driver phone</p><p className="font-medium">{transport.driver_phone ?? "—"}</p></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned to a transport route yet.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="meals" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Meal</TableHead>
                <TableHead>Menu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mealMenu.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{new Date(m.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{m.meal_type}</Badge></TableCell>
                  <TableCell>{m.description}</TableCell>
                </TableRow>
              ))}
              {mealMenu.length === 0 && (
                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No menu published yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="awards" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Award</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {awards.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{new Date(a.date_awarded).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{a.category ? <Badge variant="outline" className="capitalize">{a.category}</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
              {awards.length === 0 && (
                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No awards yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="activities" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentActivities.map((a) => (
                <TableRow key={a.activity_id}>
                  <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{a.activity_name}</TableCell>
                  <TableCell>{a.category ? <Badge variant="outline" className="capitalize">{a.category}</Badge> : "—"}</TableCell>
                  <TableCell>{a.role ?? "—"}</TableCell>
                </TableRow>
              ))}
              {studentActivities.length === 0 && (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No activities recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="exams" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                {user?.role === "student" && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.title} <span className="text-xs text-muted-foreground">({e.subject_name})</span></TableCell>
                  <TableCell>{e.term}</TableCell>
                  <TableCell>
                    <Badge variant={e.submission_status === "graded" ? "default" : "secondary"} className="capitalize">
                      {e.submission_status?.replace("_", " ") ?? "Not started"}
                    </Badge>
                  </TableCell>
                  <TableCell>{e.score !== null ? `${e.score}/${e.total_marks}` : "—"}</TableCell>
                  {user?.role === "student" && (
                    <TableCell className="text-right">
                      {e.paper_file_url ? (
                        <Button size="sm" variant="outline" render={<a href={e.paper_file_url} target="_blank" rel="noreferrer">Download paper</a>} />
                      ) : e.opens_at && new Date(e.opens_at) > new Date() ? (
                        <span className="text-xs text-muted-foreground">Opens {new Date(e.opens_at).toLocaleString()}</span>
                      ) : e.closes_at && new Date(e.closes_at) < new Date() && e.submission_status === null ? (
                        <span className="text-xs text-muted-foreground">Window closed</span>
                      ) : (
                        (e.submission_status === null || e.submission_status === "in_progress") && (
                          <Button size="sm" render={<Link href={`/dashboard/take-exam/${e.id}`}><PlayCircle /> {e.submission_status === "in_progress" ? "Continue" : "Start"}</Link>} />
                        )
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {exams.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No exams available yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="homework" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                {user?.role === "student" && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {homework.map((hw) => {
                const style = HOMEWORK_STATUS_STYLE[hw.status];
                const Icon = style.icon;
                return (
                  <TableRow key={hw.id}>
                    <TableCell className="font-medium">
                      {hw.title} <span className="text-xs text-muted-foreground">({hw.subject_name})</span>
                      {hw.attachment_url && (
                        <a href={hw.attachment_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="size-3" /> Worksheet
                        </a>
                      )}
                    </TableCell>
                    <TableCell>{new Date(hw.due_date + "T12:00:00").toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={style.variant} className="gap-1"><Icon className="size-3" /> {style.label}</Badge>
                    </TableCell>
                    <TableCell>{hw.score ?? "—"}</TableCell>
                    {user?.role === "student" && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hw.file_url && (
                            <a href={hw.file_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                              <ExternalLink className="size-4" />
                            </a>
                          )}
                          {hw.allow_digital_submission && hw.status !== "reviewed" && (
                            <SubmitHomeworkDialog
                              studentId={studentId}
                              homework={hw}
                              onSubmitted={(updated) => setHomework((h) => h.map((x) => (x.id === updated.id ? updated : x)))}
                            />
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {homework.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No homework posted yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="pickup" className="mt-4">
        {user?.role === "parent" && (
          <div className="mb-4 flex flex-wrap gap-3 rounded-xl border bg-muted/30 p-4">
            <Button size="lg" disabled={reportingEvent !== null} onClick={() => reportPickupDropoff("pickup")} className="flex-1 gap-2 sm:flex-none">
              {reportingEvent === "pickup" ? <Spinner size={16} className="text-current" /> : <LogOut />} I&apos;m picking up now
            </Button>
            <Button size="lg" variant="outline" disabled={reportingEvent !== null} onClick={() => reportPickupDropoff("dropoff")} className="flex-1 gap-2 sm:flex-none">
              {reportingEvent === "dropoff" ? <Spinner size={16} className="text-current" /> : <LogIn />} I&apos;ve dropped off now
            </Button>
          </div>
        )}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickupDropoff.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.occurred_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={p.event_type === "pickup" ? "default" : "secondary"} className="capitalize">{p.event_type}</Badge></TableCell>
                  <TableCell>{p.person_name}</TableCell>
                  <TableCell>{p.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
              {pickupDropoff.length === 0 && (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No pickup/drop-off records yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
