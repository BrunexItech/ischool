"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  api,
  ApiError,
  CompetencyAssessment,
  MyClass,
  ObservationNote,
  PerformanceLevel,
  Student,
  Subject,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { localDateStr } from "@/lib/dates";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, ClipboardList, NotebookPen, RotateCw, Search, UserRound, Users } from "lucide-react";

const LEVEL_LABELS: Record<PerformanceLevel, string> = {
  exceeding_expectation: "Exceeding Expectation",
  meeting_expectation: "Meeting Expectation",
  approaching_expectation: "Approaching Expectation",
  below_expectation: "Below Expectation",
};

const LEVEL_VARIANT: Record<PerformanceLevel, "default" | "secondary" | "outline" | "destructive"> = {
  exceeding_expectation: "default",
  meeting_expectation: "secondary",
  approaching_expectation: "outline",
  below_expectation: "destructive",
};

function todayStr() {
  return localDateStr();
}

function CompetencyDialog({
  student,
  classId,
  subjects,
  onSaved,
}: {
  student: Student;
  classId: number;
  subjects: Subject[];
  onSaved: (c: CompetencyAssessment) => void;
}) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject_id: "", term: "", strand: "", sub_strand: "", criterion: "",
    performance_level: "meeting_expectation" as PerformanceLevel, assessment_date: todayStr(),
    teacher_comment: "", follow_up_action: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.subject_id || !form.term || !form.strand || !form.criterion) return;
    setSubmitting(true);
    try {
      const created = await api.createCompetencyAssessment(token, user.school_id, {
        student_id: student.id, class_id: classId, subject_id: Number(form.subject_id), term: form.term,
        strand: form.strand, sub_strand: form.sub_strand || undefined, criterion: form.criterion,
        performance_level: form.performance_level, assessment_date: form.assessment_date,
        teacher_comment: form.teacher_comment || undefined, follow_up_action: form.follow_up_action || undefined,
      });
      onSaved(created);
      setOpen(false);
      setForm((f) => ({ ...f, strand: "", sub_strand: "", criterion: "", teacher_comment: "", follow_up_action: "" }));
      toast.success("Competency assessment recorded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="h-10 sm:h-8"><ClipboardList /> Record assessment</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Record a competency assessment — {student.first_name} {student.last_name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Learning area / subject</Label>
            <Select value={form.subject_id} onValueChange={(v) => v && setForm((f) => ({ ...f, subject_id: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Term</Label>
            <Input required placeholder="e.g. Term 1 2026" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Strand</Label>
            <Input required value={form.strand} onChange={(e) => setForm((f) => ({ ...f, strand: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Sub-strand (optional)</Label>
            <Input value={form.sub_strand} onChange={(e) => setForm((f) => ({ ...f, sub_strand: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Competency / criterion being assessed</Label>
            <Textarea required rows={2} value={form.criterion} onChange={(e) => setForm((f) => ({ ...f, criterion: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Performance level</Label>
            <Select value={form.performance_level} onValueChange={(v) => v && setForm((f) => ({ ...f, performance_level: v as PerformanceLevel }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(LEVEL_LABELS) as PerformanceLevel[]).map((l) => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input required type="date" value={form.assessment_date} onChange={(e) => setForm((f) => ({ ...f, assessment_date: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Teacher comment (optional)</Label>
            <Textarea rows={2} value={form.teacher_comment} onChange={(e) => setForm((f) => ({ ...f, teacher_comment: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Follow-up action (optional)</Label>
            <Input value={form.follow_up_action} onChange={(e) => setForm((f) => ({ ...f, follow_up_action: e.target.value }))} />
          </div>
          <Button type="submit" disabled={submitting} className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Save assessment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ObservationDialog({ student, classId, onSaved }: { student: Student; classId: number; onSaved: (n: ObservationNote) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [notedOn, setNotedOn] = useState(todayStr());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !note.trim()) return;
    setSubmitting(true);
    try {
      const created = await api.createObservationNote(token, user.school_id, {
        student_id: student.id, class_id: classId, note: note.trim(), noted_on: notedOn,
      });
      onSaved(created);
      setOpen(false);
      setNote("");
      toast.success("Observation added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-10 sm:h-8"><NotebookPen /> Add observation</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Observation note — {student.first_name} {student.last_name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input required type="date" value={notedOn} onChange={(e) => setNotedOn(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Textarea required rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you observe today?" />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StudentHistory({ studentId, refreshKey }: { studentId: number; refreshKey: number }) {
  const { token, user } = useAuth();
  const [assessments, setAssessments] = useState<CompetencyAssessment[]>([]);
  const [notes, setNotes] = useState<ObservationNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listCompetencyAssessments(token, user.school_id, studentId).then(setAssessments).catch(() => setAssessments([])),
      api.listObservationNotes(token, user.school_id, studentId).then(setNotes).catch(() => setNotes([])),
    ]).finally(() => setLoading(false));
  }, [token, user?.school_id, studentId, refreshKey]);

  if (loading) return <Spinner size={16} />;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {assessments.map((a) => (
        <div key={`a-${a.id}`} className="rounded-lg border p-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{a.strand}{a.sub_strand ? ` · ${a.sub_strand}` : ""}</p>
            <Badge variant={LEVEL_VARIANT[a.performance_level]}>{LEVEL_LABELS[a.performance_level]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{a.criterion}</p>
          <p className="text-xs text-muted-foreground">{a.term} · {new Date(a.assessment_date + "T12:00:00").toLocaleDateString()}</p>
          {a.teacher_comment && <p className="mt-1 text-xs">{a.teacher_comment}</p>}
        </div>
      ))}
      {notes.map((n) => (
        <div key={`n-${n.id}`} className="rounded-lg border border-dashed p-2.5 text-sm">
          <p>{n.note}</p>
          <p className="text-xs text-muted-foreground">{new Date(n.noted_on + "T12:00:00").toLocaleDateString()}</p>
        </div>
      ))}
      {assessments.length === 0 && notes.length === 0 && (
        <p className="text-sm text-muted-foreground">No competency assessments or observations yet.</p>
      )}
    </div>
  );
}

const AVATAR_TONES = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

function initials(s: Student) {
  return `${s.first_name.charAt(0)}${s.last_name.charAt(0)}`.toUpperCase();
}

function Banner({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#6e1316] px-5 py-4 text-primary-foreground shadow-sm sm:px-6 sm:py-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-sidebar-primary" aria-hidden />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 sm:size-14">
            <NotebookPen className="size-6 sm:size-7" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl">{title}</h1>
            <p className="text-sm text-primary-foreground/80">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function StudentActions({ s, classId, subjects, expanded, onToggle, onSaved }: { s: Student; classId: number; subjects: Subject[]; expanded: boolean; onToggle: () => void; onSaved: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CompetencyDialog student={s} classId={classId} subjects={subjects} onSaved={onSaved} />
      <ObservationDialog student={s} classId={classId} onSaved={onSaved} />
      <Button size="sm" variant="ghost" className="h-10 sm:h-8" onClick={onToggle} aria-expanded={expanded}>
        <ChevronDown className={expanded ? "rotate-180" : ""} /> {expanded ? "Hide history" : "View history"}
      </Button>
    </div>
  );
}

function ClassCompetencyView({ classInfo, onBack }: { classInfo: MyClass; onBack: () => void }) {
  const { user, token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshKeys, setRefreshKeys] = useState<Record<number, number>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    Promise.all([
      api.listStudents(token, user.school_id, classInfo.class_id).then((r) => ({ ok: true, r })).catch(() => ({ ok: false, r: [] as Student[] })),
      api.listSubjects(token, user.school_id).catch(() => [] as Subject[]),
    ]).then(([st, ss]) => {
      if (cancelled) return;
      setStudents(st.r);
      setSubjects(ss);
      setFailed(!st.ok);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, classInfo.class_id, reloadKey]);

  // Serial numbers follow the alphabetical roll so they stay stable while searching.
  const roll = useMemo(
    () =>
      [...students]
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
        .map((s, i) => ({ s, no: i + 1 })),
    [students],
  );

  function bump(studentId: number) {
    setRefreshKeys((r) => ({ ...r, [studentId]: (r[studentId] ?? 0) + 1 }));
  }

  if (loading) return <PageLoader />;

  const q = search.trim().toLowerCase();
  const visible = roll.filter(({ s }) => !q || `${s.first_name} ${s.last_name} ${s.admission_number}`.toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="h-10 w-fit sm:h-8"><ArrowLeft /> All my classes</Button>
      <Banner title={classInfo.class_name} subtitle="Record competency assessments and observation notes for each learner.">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium">
          <Users className="size-4" /> {students.length} learner{students.length === 1 ? "" : "s"}
        </span>
      </Banner>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="font-heading text-lg font-semibold">Class list</h2>
          {students.length > 0 && (
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or admission no..." aria-label="Search learners" className="h-10 pl-8 sm:h-9" />
            </div>
          )}
        </div>

        {failed ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <AlertTriangle className="size-6 text-red-600" />
            <p className="text-sm text-muted-foreground">We couldn&apos;t load the learners.</p>
            <Button size="sm" variant="outline" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}><RotateCw /> Try again</Button>
          </div>
        ) : students.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No learners in this class yet.</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No learners match your search.</p>
        ) : (
          <ul className="divide-y">
            {visible.map(({ s, no }) => {
              const isOpen = expanded === s.id;
              return (
                <li key={s.id} className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums" aria-label={`Number ${no}`}>
                        {String(no).padStart(2, "0")}
                      </span>
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${AVATAR_TONES[(s.id + no) % AVATAR_TONES.length]}`} aria-hidden>
                        {initials(s)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium break-words">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-muted-foreground">Adm. no. {s.admission_number}</p>
                      </div>
                    </div>
                    <StudentActions s={s} classId={classInfo.class_id} subjects={subjects} expanded={isOpen} onToggle={() => setExpanded(isOpen ? null : s.id)} onSaved={() => bump(s.id)} />
                  </div>
                  {isOpen && (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <StudentHistory studentId={s.id} refreshKey={refreshKeys[s.id] ?? 0} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function CompetencyPage() {
  const { user, token, loading } = useAuth();
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    api
      .listMyClasses(token, user.school_id)
      .then((r) => ({ ok: true, r }))
      .catch(() => ({ ok: false, r: [] as MyClass[] }))
      .then(({ ok, r }) => {
        if (cancelled) return;
        setMyClasses(r);
        setFailed(!ok);
        setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, reloadKey]);

  const selectedClass = myClasses.find((c) => c.class_id === selectedClassId);

  if (loading || classesLoading) return <PageLoader />;

  if (selectedClass) {
    return <ClassCompetencyView key={selectedClass.class_id} classInfo={selectedClass} onBack={() => setSelectedClassId(null)} />;
  }

  const totalLearners = myClasses.reduce((n, c) => n + c.student_count, 0);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <Banner title="Learner Progress" subtitle="Competency assessments and observation notes, per class.">
        {myClasses.length > 0 && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium">
            <Users className="size-4" /> {myClasses.length} class{myClasses.length === 1 ? "" : "es"} · {totalLearners} learners
          </span>
        )}
      </Banner>

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load your classes.</p>
          <Button size="sm" variant="outline" onClick={() => { setClassesLoading(true); setReloadKey((k) => k + 1); }}><RotateCw /> Try again</Button>
        </div>
      ) : myClasses.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No classes assigned to you yet.</div>
      ) : (
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold">Choose a class</h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {myClasses.map((c, i) => (
              <button
                key={c.class_id}
                type="button"
                onClick={() => setSelectedClassId(c.class_id)}
                className="group flex items-center gap-3.5 rounded-xl border bg-card p-4 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${AVATAR_TONES[i % AVATAR_TONES.length]}`}>
                  <UserRound className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-base font-semibold break-words">{c.class_name}</span>
                  <span className="block text-sm text-muted-foreground">{c.student_count} learner{c.student_count === 1 ? "" : "s"}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
