"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  LayoutGrid,
  List,
  Mail,
  Phone,
  RotateCw,
  Search,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { api, ApiError, Award, GradeLevel, LevelGroup, MyClass, SchoolClass, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";

const UNASSIGNED = -1;

type LevelKey = LevelGroup | "other";

const LEVEL_ORDER: LevelKey[] = ["pre_primary", "primary", "junior_school", "senior_school", "other"];
const LEVEL_LABEL: Record<LevelKey, string> = {
  pre_primary: "Pre-Primary",
  primary: "Primary School",
  junior_school: "Junior School",
  senior_school: "Senior School",
  other: "Other classes",
};
const LEVEL_BAR: Record<LevelKey, string> = {
  pre_primary: "bg-rose-500",
  primary: "bg-sky-500",
  junior_school: "bg-emerald-500",
  senior_school: "bg-violet-500",
  other: "bg-amber-500",
};

const AVATAR_TONES = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

interface ClassEntry {
  id: number;
  name: string;
  count: number;
  level: LevelKey;
  order: number;
  isHomeroom: boolean;
  preview: Student[];
}

interface Loaded {
  classes: SchoolClass[];
  grades: GradeLevel[];
  myClasses: MyClass[];
  students: Student[];
}

function fullName(s: Student) {
  return `${s.first_name} ${s.last_name}`;
}

function initials(s: Student) {
  return `${s.first_name.charAt(0)}${s.last_name.charAt(0)}`.toUpperCase();
}

function toneFor(s: Student) {
  return AVATAR_TONES[s.id % AVATAR_TONES.length];
}

async function fetchAll(token: string, schoolId: number, isTeacher: boolean): Promise<{ data: Loaded; failed: boolean }> {
  let failed = false;
  const [classes, grades, myClasses, students] = await Promise.all([
    api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
    api.listGradeLevels(token).catch(() => [] as GradeLevel[]),
    isTeacher
      ? api.listMyClasses(token, schoolId).catch(() => {
          failed = true;
          return [] as MyClass[];
        })
      : Promise.resolve([] as MyClass[]),
    isTeacher
      ? Promise.resolve([] as Student[])
      : api.listStudents(token, schoolId).catch(() => {
          failed = true;
          return [] as Student[];
        }),
  ]);
  return { data: { classes, grades, myClasses, students }, failed };
}

function Banner({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#6e1316] px-5 py-4 text-primary-foreground shadow-sm sm:px-6 sm:py-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-sidebar-primary" aria-hidden />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 sm:size-14">
            <Users className="size-6 sm:size-7" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl">{title}</h1>
            <p className="text-sm text-primary-foreground/80">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium">{children}</span>;
}

function Avatar({ s, size = "md" }: { s: Student; size?: "md" | "lg" | "xl" }) {
  const dim = size === "xl" ? "size-20 text-2xl" : size === "lg" ? "size-14 text-lg sm:size-16 sm:text-xl" : "size-10 text-sm";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${dim} ${toneFor(s)}`} aria-hidden>
      {initials(s)}
    </span>
  );
}

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={`${label}: ${ok ? "active" : "not set up"}`}>
      <span className={`size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} aria-hidden />
      <span>{label}</span>
      <span className="sr-only">{ok ? "active" : "not set up"}</span>
    </span>
  );
}

function Serial({ n }: { n: number }) {
  return (
    <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums" aria-label={`Number ${n}`}>
      {String(n).padStart(2, "0")}
    </span>
  );
}

function StatusLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
      {ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />} {children}
    </span>
  );
}

function PortalAccessPanel({ student, onUpdated }: { student: Student; onUpdated: (s: Student) => void }) {
  const { token, user } = useAuth();
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [guardianEmail, setGuardianEmail] = useState(student.guardian_email ?? "");
  const [guardianPassword, setGuardianPassword] = useState("");
  const [studentConsent, setStudentConsent] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [submittingStudent, setSubmittingStudent] = useState(false);
  const [submittingGuardian, setSubmittingGuardian] = useState(false);

  async function handleCreateStudentAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmittingStudent(true);
    try {
      const updated = await api.createStudentAccount(token, user.school_id, student.id, { email: studentEmail, password: studentPassword });
      onUpdated(updated);
      toast.success("Student login created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create student login");
    } finally {
      setSubmittingStudent(false);
    }
  }

  async function handleCreateGuardianAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmittingGuardian(true);
    try {
      const updated = await api.createGuardianAccount(token, user.school_id, student.id, {
        email: guardianEmail,
        password: guardianPassword,
        full_name: student.guardian_name || undefined,
      });
      onUpdated(updated);
      toast.success("Guardian login created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create guardian login");
    } finally {
      setSubmittingGuardian(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Learner login</p>
          <StatusLine ok={student.has_student_account}>{student.has_student_account ? "Active" : "Not set up"}</StatusLine>
        </div>
        {student.has_student_account && student.user_id ? (
          <ResetPasswordDialog userId={student.user_id} label={fullName(student)} />
        ) : (
          <form onSubmit={handleCreateStudentAccount} className="flex flex-col gap-2">
            <Input required type="email" placeholder="Learner email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
            <Input required type="password" placeholder="Password" value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)} />
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox required checked={studentConsent} onCheckedChange={(v) => setStudentConsent(v === true)} className="mt-0.5" />
              I confirm the required consent has been obtained to create this account and process this student&apos;s data.
            </label>
            <Button size="sm" type="submit" disabled={submittingStudent || !studentConsent} className="w-fit">
              {submittingStudent ? "Creating..." : "Create login"}
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Guardian login</p>
          <StatusLine ok={student.has_guardian_account}>{student.has_guardian_account ? "Active" : "Not set up"}</StatusLine>
        </div>
        {student.has_guardian_account && student.guardian_user_id ? (
          <ResetPasswordDialog userId={student.guardian_user_id} label={student.guardian_name || "Guardian"} />
        ) : (
          <form onSubmit={handleCreateGuardianAccount} className="flex flex-col gap-2">
            <Input required type="email" placeholder="Guardian email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
            <Input required type="password" placeholder="Password" value={guardianPassword} onChange={(e) => setGuardianPassword(e.target.value)} />
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox required checked={guardianConsent} onCheckedChange={(v) => setGuardianConsent(v === true)} className="mt-0.5" />
              I confirm the guardian has consented to this account and to Milai School processing their and their child&apos;s data.
            </label>
            <Button size="sm" type="submit" disabled={submittingGuardian || !guardianConsent} className="w-fit">
              {submittingGuardian ? "Creating..." : "Create login"}
            </Button>
            <p className="text-xs text-muted-foreground">If this email already has a guardian account (a sibling is already enrolled), this learner is simply linked to it.</p>
          </form>
        )}
      </div>
    </div>
  );
}

function AwardsList({ studentId }: { studentId: number }) {
  const { token, user } = useAuth();
  const [state, setState] = useState<{ id: number; awards: Award[] } | null>(null);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    api
      .listAwards(token, user.school_id, { student_id: studentId, include_shared: true })
      .catch(() => [] as Award[])
      .then((awards) => !cancelled && setState({ id: studentId, awards }));
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, studentId]);

  if (!state || state.id !== studentId || state.awards.length === 0) return null;
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Awards</p>
      <ul className="flex flex-col gap-2.5">
        {state.awards.slice(0, 6).map((a) => (
          <li key={a.id}>
            <Link href={`/dashboard/awards/${a.id}/certificate`} className="block rounded-md outline-none hover:bg-accent/50 focus-visible:bg-accent/50">
              <span className="block text-sm font-medium break-words">{a.title}</span>
              <span className="block text-xs text-muted-foreground">
                {a.scope === "class" ? "Whole class" : a.scope === "school" ? "Whole school" : "Individual"}
                {a.term ? ` · ${a.term}` : ""} · {new Date(a.date_awarded + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LearnerDrawer({
  student,
  className,
  canManage,
  onClose,
  onUpdated,
}: {
  student: Student | null;
  className: string | null;
  canManage: boolean;
  onClose: () => void;
  onUpdated: (s: Student) => void;
}) {
  const [tab, setTab] = useState<"overview" | "portal">("overview");
  return (
    <Sheet open={student !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {student && (
          <>
            <SheetHeader className="items-center gap-3 border-b bg-muted/30 pt-8 pb-5 text-center">
              <Avatar s={student} size="xl" />
              <div>
                <SheetTitle className="font-heading text-xl break-words">{fullName(student)}</SheetTitle>
                <SheetDescription>
                  {className ?? "Not yet in a class"} · Adm. no. {student.admission_number}
                </SheetDescription>
              </div>
              <StatusLine ok={student.is_active}>{student.is_active ? "Active learner" : "Inactive"}</StatusLine>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-6">
              {canManage && (
                <div role="tablist" aria-label="Learner sections" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(
                    [
                      ["overview", "Overview"],
                      ["portal", "Portal access"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={`h-9 rounded-md text-sm font-medium transition-colors ${tab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {tab === "portal" && canManage ? (
                <PortalAccessPanel key={student.id} student={student} onUpdated={onUpdated} />
              ) : (
                <>
                  <div className="rounded-xl border p-4">
                    <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Guardian</p>
                    {student.guardian_name || student.guardian_phone || student.guardian_email ? (
                      <div className="flex flex-col gap-3">
                        <p className="font-medium">{student.guardian_name ?? "Name not recorded"}</p>
                        {student.guardian_phone ? (
                          <Button variant="outline" className="h-11 justify-start" nativeButton={false} render={<a href={`tel:${student.guardian_phone}`}><Phone /> {student.guardian_phone}</a>} />
                        ) : (
                          <p className="text-sm text-muted-foreground">No phone number recorded.</p>
                        )}
                        {student.guardian_email && (
                          <Button variant="outline" className="h-11 justify-start" nativeButton={false} render={<a href={`mailto:${student.guardian_email}`}><Mail /> <span className="break-all">{student.guardian_email}</span></a>} />
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No guardian details have been recorded for this learner.</p>
                    )}
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Details</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Admission no.</dt>
                      <dd className="font-medium">{student.admission_number}</dd>
                      <dt className="text-muted-foreground">Class</dt>
                      <dd className="font-medium">{className ?? "Not yet in a class"}</dd>
                      {student.gender && (
                        <>
                          <dt className="text-muted-foreground">Gender</dt>
                          <dd className="font-medium capitalize">{student.gender}</dd>
                        </>
                      )}
                      {student.date_of_birth && (
                        <>
                          <dt className="text-muted-foreground">Date of birth</dt>
                          <dd className="font-medium">{new Date(student.date_of_birth + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd>
                        </>
                      )}
                    </dl>
                    {canManage && (
                      <>
                        <Separator className="my-3" />
                        <div className="flex flex-wrap gap-3">
                          <Dot ok={student.has_student_account} label="Learner portal" />
                          <Dot ok={student.has_guardian_account} label="Guardian portal" />
                        </div>
                      </>
                    )}
                  </div>
                  <AwardsList studentId={student.id} />
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EnrolDialog({
  classes,
  initialClassId,
  onClose,
  onCreated,
}: {
  classes: SchoolClass[];
  initialClassId: number | null;
  onClose: () => void;
  onCreated: (s: Student) => void;
}) {
  const { token, user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    admission_number: "",
    first_name: "",
    last_name: "",
    class_id: initialClassId && initialClassId > 0 ? String(initialClassId) : "",
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const STEPS = ["Learner", "Class", "Guardian"];
  const className = classes.find((c) => String(c.id) === form.class_id)?.name;

  function next() {
    if (step === 0 && (!form.admission_number.trim() || !form.first_name.trim() || !form.last_name.trim())) {
      toast.error("Enter the admission number, first name and last name");
      return;
    }
    setStep((s) => s + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 2) return next();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.createStudent(token, user.school_id, {
        admission_number: form.admission_number.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        class_id: form.class_id ? Number(form.class_id) : undefined,
        guardian_name: form.guardian_name.trim() || undefined,
        guardian_phone: form.guardian_phone.trim() || undefined,
        guardian_email: form.guardian_email.trim() || undefined,
      });
      onCreated(created);
      toast.success(`${fullName(created)} enrolled`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to enrol learner");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enrol a learner</DialogTitle>
        </DialogHeader>
        <ol className="flex items-center gap-2" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col gap-1.5" aria-current={i === step ? "step" : undefined}>
              <span className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <span className={`text-xs font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {step === 0 && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Admission number</Label>
                <Input autoFocus value={form.admission_number} onChange={(e) => set("admission_number", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>First name</Label>
                  <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Last name</Label>
                  <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={form.class_id} onValueChange={(v) => set("class_id", v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No class yet" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">You can leave this empty and place the learner in a class later.</p>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Guardian name</Label>
                <Input autoFocus value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Guardian phone</Label>
                  <Input type="tel" value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Guardian email</Label>
                  <Input type="email" value={form.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} />
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">
                  {form.first_name} {form.last_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Adm. no. {form.admission_number} · {className ?? "No class yet"}
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner size={16} className="text-current" />} {step < 2 ? "Continue" : submitting ? "Enrolling..." : "Enrol learner"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LearnerTag({ s, no, canManage, highlight, onOpen }: { s: Student; no: number; canManage: boolean; highlight: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative flex flex-col items-center gap-2 rounded-2xl border bg-card px-3 pt-4 pb-3.5 text-center shadow-sm transition-all outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring ${highlight ? "border-primary ring-2 ring-primary/40" : ""}`}
    >
      <span className="absolute top-2.5 left-2.5">
        <Serial n={no} />
      </span>
      <Avatar s={s} size="lg" />
      <span className="w-full min-w-0">
        <span className="block font-medium break-words">{fullName(s)}</span>
        <span className="block text-xs text-muted-foreground">Adm. {s.admission_number}</span>
      </span>
      <span className="w-full min-w-0 border-t pt-2 text-xs text-muted-foreground">
        {s.guardian_name || s.guardian_phone ? (
          <>
            {s.guardian_name && <span className="block break-words">{s.guardian_name}</span>}
            {s.guardian_phone && <span className="block tabular-nums">{s.guardian_phone}</span>}
          </>
        ) : (
          <span>No guardian recorded</span>
        )}
      </span>
      {canManage && (
        <span className="flex flex-wrap justify-center gap-x-2.5 gap-y-0.5">
          <Dot ok={s.has_student_account} label="Learner" />
          <Dot ok={s.has_guardian_account} label="Guardian" />
        </span>
      )}
    </button>
  );
}

function LearnerRow({ s, no, canManage, highlight, onOpen }: { s: Student; no: number; canManage: boolean; highlight: boolean; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-accent/50 focus-visible:bg-accent/50 sm:px-5 ${highlight ? "bg-primary/5" : ""}`}>
        <Serial n={no} />
        <Avatar s={s} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium break-words">{fullName(s)}</span>
          <span className="block text-xs text-muted-foreground">Adm. {s.admission_number}</span>
        </span>
        <span className="hidden min-w-0 flex-1 text-sm text-muted-foreground md:block">
          {s.guardian_name ?? "No guardian recorded"}
          {s.guardian_phone && <span className="block text-xs tabular-nums">{s.guardian_phone}</span>}
        </span>
        {canManage && (
          <span className="hidden flex-col gap-0.5 lg:flex">
            <Dot ok={s.has_student_account} label="Learner" />
            <Dot ok={s.has_guardian_account} label="Guardian" />
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

function StudentsView() {
  const { user, token, loading } = useAuth();
  const searchParams = useSearchParams();
  const schoolId = user?.school_id ?? null;
  const isTeacher = user?.role === "teacher";
  const canEnrol = user?.role === "head_of_institution" || user?.role === "staff" || user?.role === "super_admin" || user?.role === "group_principal";

  const [data, setData] = useState<Loaded>({ classes: [], grades: [], myClasses: [], students: [] });
  const [dataLoading, setDataLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const fromUrl = searchParams.get("class_id");
    return fromUrl ? Number(fromUrl) : null;
  });
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [shelfSearch, setShelfSearch] = useState("");
  const [rollSearch, setRollSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "no_phone" | "no_portal">("all");
  const [view, setView] = useState<"tags" | "list">("tags");
  const [openId, setOpenId] = useState<number | null>(null);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [justAddedId, setJustAddedId] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    fetchAll(token, schoolId, isTeacher).then(({ data: d, failed: f }) => {
      if (cancelled) return;
      setData(d);
      setFailed(f);
      setDataLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, reloadKey]);

  // Teachers only ever see their own class, so its learners load on demand.
  useEffect(() => {
    if (!token || !schoolId || !isTeacher || selectedId === null) return;
    let cancelled = false;
    api
      .listStudents(token, schoolId, selectedId)
      .catch(() => [] as Student[])
      .then((r) => {
        if (cancelled) return;
        setData((d) => ({ ...d, students: r }));
        setLoadedFor(selectedId);
      });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, selectedId]);

  const entries = useMemo<ClassEntry[]>(() => {
    const gradeById: Record<number, GradeLevel> = {};
    for (const g of data.grades) gradeById[g.id] = g;
    const classById: Record<number, SchoolClass> = {};
    for (const c of data.classes) classById[c.id] = c;
    const levelOf = (classId: number): { level: LevelKey; order: number } => {
      const gl = classById[classId]?.grade_level_id;
      const g = gl ? gradeById[gl] : undefined;
      return g ? { level: g.level_group, order: g.sort_order } : { level: "other", order: 999 };
    };
    let list: ClassEntry[];
    if (isTeacher) {
      list = data.myClasses.map((c) => ({
        id: c.class_id,
        name: c.class_name,
        count: c.student_count,
        isHomeroom: c.is_homeroom_teacher,
        preview: [],
        ...levelOf(c.class_id),
      }));
    } else {
      list = data.classes.map((c) => {
        const mine = data.students.filter((s) => s.class_id === c.id);
        return { id: c.id, name: c.name, count: mine.length, isHomeroom: false, preview: mine.slice(0, 4), ...levelOf(c.id) };
      });
      const loose = data.students.filter((s) => !s.class_id || !classById[s.class_id]);
      if (loose.length > 0) {
        list.push({ id: UNASSIGNED, name: "Not yet in a class", count: loose.length, isHomeroom: false, preview: loose.slice(0, 4), level: "other", order: 1000 });
      }
    }
    return list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [data, isTeacher]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const rollStudents = useMemo(() => {
    if (!selected) return [];
    const inClass = isTeacher
      ? data.students
      : data.students.filter((s) => (selected.id === UNASSIGNED ? !s.class_id || !data.classes.some((c) => c.id === s.class_id) : s.class_id === selected.id));
    return [...inClass]
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
      .map((s, i) => ({ s, no: i + 1 }));
  }, [selected, isTeacher, data.students, data.classes]);

  function updateStudent(updated: Student) {
    setData((d) => ({ ...d, students: d.students.map((s) => (s.id === updated.id ? updated : s)) }));
  }

  function classNameOf(s: Student) {
    if (!s.class_id) return null;
    return data.classes.find((c) => c.id === s.class_id)?.name ?? data.myClasses.find((c) => c.class_id === s.class_id)?.class_name ?? null;
  }

  if (loading || dataLoading) return <PageLoader />;

  const openStudent = data.students.find((s) => s.id === openId) ?? null;
  const totalLearners = isTeacher ? entries.reduce((n, e) => n + e.count, 0) : data.students.length;

  const drawer = (
    <LearnerDrawer student={openStudent} className={openStudent ? classNameOf(openStudent) : null} canManage={canEnrol} onClose={() => setOpenId(null)} onUpdated={updateStudent} />
  );
  const enrol = enrolOpen && canEnrol && (
    <EnrolDialog
      classes={data.classes}
      initialClassId={selectedId}
      onClose={() => setEnrolOpen(false)}
      onCreated={(s) => {
        setData((d) => ({ ...d, students: [...d.students, s] }));
        setJustAddedId(s.id);
        window.setTimeout(() => setJustAddedId(null), 4000);
      }}
    />
  );
  const enrolButton = canEnrol && (
    <Button onClick={() => setEnrolOpen(true)} className="h-10 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:h-9">
      <UserPlus /> Enrol learner
    </Button>
  );

  if (failed) {
    return (
      <div className="flex flex-col gap-5">
        <Banner title="Students" subtitle="Your classes and learners." />
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the learners.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDataLoading(true);
              setReloadKey((k) => k + 1);
            }}
          >
            <RotateCw /> Try again
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Class roll ----------
  if (selected) {
    const noPhone = rollStudents.filter(({ s }) => !s.guardian_phone).length;
    const noPortal = rollStudents.filter(({ s }) => !s.has_student_account || !s.has_guardian_account).length;
    const q = rollSearch.trim().toLowerCase();
    const visible = rollStudents.filter(({ s }) => {
      if (filter === "no_phone" && s.guardian_phone) return false;
      if (filter === "no_portal" && s.has_student_account && s.has_guardian_account) return false;
      if (!q) return true;
      return `${fullName(s)} ${s.admission_number} ${s.guardian_name ?? ""}`.toLowerCase().includes(q);
    });
    const rollLoading = isTeacher && loadedFor !== selected.id;
    const filters: { key: "all" | "no_phone" | "no_portal"; label: string; count: number }[] = [
      { key: "all", label: "All learners", count: rollStudents.length },
      { key: "no_phone", label: "No guardian phone", count: noPhone },
      ...(canEnrol ? [{ key: "no_portal" as const, label: "Portal not set up", count: noPortal }] : []),
    ];

    return (
      <div className="flex flex-col gap-5">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-fit sm:h-8"
          onClick={() => {
            setSelectedId(null);
            setRollSearch("");
            setFilter("all");
          }}
        >
          <ArrowLeft /> All classes
        </Button>
        <Banner title={selected.name} subtitle={selected.isHomeroom ? "You are the class teacher of this class." : LEVEL_LABEL[selected.level]}>
          <Chip>
            <Users className="size-4" /> {rollLoading ? selected.count : rollStudents.length} learner{(rollLoading ? selected.count : rollStudents.length) === 1 ? "" : "s"}
          </Chip>
          {enrolButton}
        </Banner>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-heading text-lg font-semibold">Class list</h2>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64 sm:flex-none">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={rollSearch} onChange={(e) => setRollSearch(e.target.value)} placeholder="Search learners..." aria-label="Search learners" className="h-10 pl-8 sm:h-9" />
                </div>
                <div className="flex overflow-hidden rounded-lg border" role="group" aria-label="Layout">
                  {(
                    [
                      ["tags", "Tag view", LayoutGrid],
                      ["list", "Roll view", List],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={label}
                      aria-pressed={view === key}
                      onClick={() => setView(key)}
                      className={`flex size-10 items-center justify-center transition-colors sm:size-9 ${view === key ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                    >
                      <Icon className="size-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {f.label}
                  <span className={`rounded-full px-1.5 text-xs tabular-nums ${filter === f.key ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {rollLoading ? (
            <div className="py-10">
              <PageLoader />
            </div>
          ) : rollStudents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Users className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No learners in this class yet</p>
              {canEnrol && (
                <Button size="sm" className="mt-1" onClick={() => setEnrolOpen(true)}>
                  <UserPlus /> Enrol learner
                </Button>
              )}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <p className="text-sm font-medium">No learners match</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRollSearch("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : view === "tags" ? (
            <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-5 md:grid-cols-3 xl:grid-cols-4">
              {visible.map(({ s, no }) => (
                <LearnerTag key={s.id} s={s} no={no} canManage={canEnrol} highlight={s.id === justAddedId} onOpen={() => setOpenId(s.id)} />
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map(({ s, no }) => (
                <LearnerRow key={s.id} s={s} no={no} canManage={canEnrol} highlight={s.id === justAddedId} onOpen={() => setOpenId(s.id)} />
              ))}
            </ul>
          )}
        </section>
        {drawer}
        {enrol}
      </div>
    );
  }

  // ---------- Class shelf ----------
  const q = shelfSearch.trim().toLowerCase();
  const learnerHits = !isTeacher && q ? data.students.filter((s) => `${fullName(s)} ${s.admission_number} ${s.guardian_name ?? ""}`.toLowerCase().includes(q)).slice(0, 30) : [];
  const classHits = entries.filter((e) => !q || e.name.toLowerCase().includes(q));
  const groups = LEVEL_ORDER.map((level) => ({ level, items: classHits.filter((e) => e.level === level) })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <Banner title="Students" subtitle={isTeacher ? "Choose a class to see its learners." : "Browse every class and learner in the school."}>
        <Chip>
          <Users className="size-4" /> {entries.length} class{entries.length === 1 ? "" : "es"} · {totalLearners} learners
        </Chip>
        {enrolButton}
      </Banner>

      {entries.length > 0 && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={shelfSearch}
            onChange={(e) => setShelfSearch(e.target.value)}
            placeholder={isTeacher ? "Search your classes..." : "Search a class, learner, adm. no. or guardian..."}
            aria-label="Search"
            className="h-11 pl-9"
          />
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{isTeacher ? "You're not assigned to any classes yet." : "No classes or learners yet."}</p>
        </div>
      ) : (
        <>
          {learnerHits.length > 0 && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <h2 className="border-b px-4 py-3 font-heading text-lg font-semibold sm:px-5">Learners</h2>
              <ul className="divide-y">
                {learnerHits.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setOpenId(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 sm:px-5">
                      <Avatar s={s} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium break-words">{fullName(s)}</span>
                        <span className="block text-xs text-muted-foreground">
                          Adm. {s.admission_number} · {classNameOf(s) ?? "Not yet in a class"}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.map((g) => (
            <section key={g.level} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className={`h-5 w-1.5 rounded-full ${LEVEL_BAR[g.level]}`} aria-hidden />
                <h2 className="font-heading text-lg font-semibold">{LEVEL_LABEL[g.level]}</h2>
                <span className="text-sm text-muted-foreground">
                  {g.items.length} class{g.items.length === 1 ? "" : "es"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {g.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setLoadedFor(null);
                    }}
                    className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={`absolute inset-y-0 left-0 w-1.5 ${LEVEL_BAR[c.level]}`} aria-hidden />
                    <span className="flex items-start gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-heading text-base font-semibold break-words">{c.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {c.count} learner{c.count === 1 ? "" : "s"}
                          {c.isHomeroom && " · Class teacher"}
                        </span>
                      </span>
                      <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                    {c.preview.length > 0 && (
                      <span className="flex items-center">
                        {c.preview.map((s) => (
                          <span key={s.id} className={`-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-card text-[11px] font-semibold first:ml-0 ${toneFor(s)}`} aria-hidden>
                            {initials(s)}
                          </span>
                        ))}
                        {c.count > c.preview.length && <span className="ml-2 text-xs text-muted-foreground">+{c.count - c.preview.length}</span>}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {q && groups.length === 0 && learnerHits.length === 0 && (
            <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">Nothing matches &ldquo;{shelfSearch}&rdquo;.</p>
          )}
        </>
      )}
      {drawer}
      {enrol}
    </div>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense fallback={<PageLoader />}>
      <StudentsView />
    </Suspense>
  );
}
