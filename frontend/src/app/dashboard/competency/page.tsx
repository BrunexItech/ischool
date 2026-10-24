"use client";

import { useEffect, useState } from "react";
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
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ClipboardList, NotebookPen } from "lucide-react";

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
  return new Date().toISOString().slice(0, 10);
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
      <DialogTrigger render={<Button size="sm"><ClipboardList /> Record assessment</Button>} />
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
      <DialogTrigger render={<Button size="sm" variant="outline"><NotebookPen /> Add observation</Button>} />
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

function ClassCompetencyView({ classInfo, onBack }: { classInfo: MyClass; onBack: () => void }) {
  const { user, token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKeys, setRefreshKeys] = useState<Record<number, number>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listStudents(token, user.school_id, classInfo.class_id).then(setStudents),
      api.listSubjects(token, user.school_id).then(setSubjects),
    ]).finally(() => setLoading(false));
  }, [token, user?.school_id, classInfo.class_id]);

  function bump(studentId: number) {
    setRefreshKeys((r) => ({ ...r, [studentId]: (r[studentId] ?? 0) + 1 }));
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={classInfo.class_name} description="Record competency assessments and observation notes for each learner." />
      <Button variant="ghost" size="sm" onClick={onBack} className="w-fit"><ArrowLeft /> All my classes</Button>

      <div className="flex flex-col gap-3">
        {students.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-muted-foreground">{s.admission_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CompetencyDialog student={s} classId={classInfo.class_id} subjects={subjects} onSaved={() => bump(s.id)} />
                  <ObservationDialog student={s} classId={classInfo.class_id} onSaved={() => bump(s.id)} />
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    {expanded === s.id ? "Hide history" : "View history"}
                  </Button>
                </div>
              </div>
              {expanded === s.id && <StudentHistory studentId={s.id} refreshKey={refreshKeys[s.id] ?? 0} />}
            </CardContent>
          </Card>
        ))}
        {students.length === 0 && (
          <Card><CardContent className="flex h-24 items-center justify-center text-sm text-muted-foreground">No learners in this class yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

export default function CompetencyPage() {
  const { user, token, loading } = useAuth();
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listMyClasses(token, user.school_id).then(setMyClasses).catch(() => setMyClasses([])).finally(() => setClassesLoading(false));
  }, [token, user?.school_id]);

  const selectedClass = myClasses.find((c) => c.class_id === selectedClassId);

  if (loading || classesLoading) return <PageLoader />;

  if (selectedClass) {
    return <ClassCompetencyView key={selectedClass.class_id} classInfo={selectedClass} onBack={() => setSelectedClassId(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Learner Progress" description="Competency assessments and observation notes, per class." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {myClasses.map((c) => (
          <button
            key={c.class_id}
            type="button"
            onClick={() => setSelectedClassId(c.class_id)}
            className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40"
          >
            <p className="font-medium">{c.class_name}</p>
            <p className="text-xs text-muted-foreground">{c.student_count} learner{c.student_count === 1 ? "" : "s"}</p>
          </button>
        ))}
        {myClasses.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="flex h-24 items-center justify-center text-sm text-muted-foreground">No classes assigned to you yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
