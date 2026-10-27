"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, AcademicTerm, ApiError, GradingBand, MyClass, SchoolClass, Student, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, LayoutList, Lock, Pencil, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { DepartmentPulse } from "@/components/DepartmentPulse";
import { ViewOnly } from "@/components/oversight";
import { ClassPerformance } from "@/components/ClassPerformance";

const EXAM_TYPES = ["Opener", "CAT 1", "CAT 2", "Mid Term", "End Term", "Mock", "Other"];

const BAND_STYLES = [
  "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100",
  "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
];

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function levelForScore(score: number, bands: GradingBand[]): GradingBand | null {
  if (bands.length === 0) return null;
  const hit = bands.find((b) => score >= b.min_score && score <= b.max_score);
  if (hit) return hit;
  return score < bands[bands.length - 1].min_score ? bands[bands.length - 1] : bands[0];
}

type BandDraft = { level_code: string; label: string; min_score: string; max_score: string; points: string };

function GradingBandsDialog({ bands, onSaved }: { bands: GradingBand[]; onSaved: (b: GradingBand[]) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<BandDraft[]>([]);
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setDrafts(
      bands.map((b) => ({
        level_code: b.level_code,
        label: b.label,
        min_score: String(b.min_score),
        max_score: String(b.max_score),
        points: String(b.points),
      }))
    );
    setOpen(true);
  }

  function updateDraft(i: number, field: keyof BandDraft, value: string) {
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      const payload = drafts.map((d) => ({
        level_code: d.level_code.trim(),
        label: d.label.trim(),
        min_score: Number(d.min_score),
        max_score: Number(d.max_score),
        points: Number(d.points),
      }));
      const updated = await api.updateGradingBands(token, user.school_id, payload);
      onSaved(updated);
      setOpen(false);
      toast.success("Grading bands updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update grading bands");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? openDialog() : setOpen(false))}>
      <DialogTrigger render={<Button variant="outline"><Pencil /> Edit grading bands</Button>} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Edit grading bands</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {drafts.map((d, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">Code</Label>
                <Input required value={d.level_code} onChange={(e) => updateDraft(i, "level_code", e.target.value)} />
              </div>
              <div className="col-span-2 grid gap-1">
                <Label className="text-xs">Label</Label>
                <Input required value={d.label} onChange={(e) => updateDraft(i, "label", e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Min</Label>
                <Input required type="number" value={d.min_score} onChange={(e) => updateDraft(i, "min_score", e.target.value)} />
              </div>
              <div className="flex items-end gap-1">
                <div className="grid flex-1 gap-1">
                  <Label className="text-xs">Max</Label>
                  <Input required type="number" value={d.max_score} onChange={(e) => updateDraft(i, "max_score", e.target.value)} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDrafts((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDrafts((rows) => [...rows, { level_code: "", label: "", min_score: "0", max_score: "100", points: "1" }])}
          >
            <Plus /> Add band
          </Button>
          <Button type="submit" disabled={saving || drafts.length === 0}>
            {saving && <Spinner size={16} className="text-current" />} {saving ? "Saving..." : "Save bands"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CorrectMarkDialog({ student, current, onClose, onSave }: { student: Student; current: string; onClose: () => void; onSave: (score: number, reason: string) => Promise<void> }) {
  const [score, setScore] = useState(current);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = score !== "" && Number(score) >= 0 && Number(score) <= 100 && reason.trim().length >= 10;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Correct {student.first_name}&apos;s mark</DialogTitle></DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await onSave(Number(score), reason.trim());
            } finally {
              setSaving(false);
            }
          }}
        >
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">This mark belongs to the teacher who entered it. Your correction is recorded with your reason in the activity log, and the teacher is told.</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fix-score">Correct mark out of 100 (now {current})</Label>
            <Input id="fix-score" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} className="h-11" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fix-reason">Reason</Label>
            <Textarea id="fix-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The teacher typed 6 instead of 62." />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-11 sm:h-9" disabled={!valid || saving}>{saving && <Spinner size={16} className="text-current" />} Save correction</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export default function ResultsPage() {
  const { user, token } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [pickedSubject, setPickedSubject] = useState<number | null>(null);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [term, setTerm] = useState("");
  const [examType, setExamType] = useState("Opener");
  const [customType, setCustomType] = useState("");
  const [bands, setBands] = useState<GradingBand[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [canSeedPrePrimary, setCanSeedPrePrimary] = useState(false);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [original, setOriginal] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState<Student | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"performance" | "gradebook">("performance");

  const isTeacher = user?.role === "teacher";
  const canConfigure = user?.role === "super_admin" || user?.role === "head_of_institution" || user?.role === "group_principal";
  const canRecord = user?.role === "super_admin" || isTeacher;
  const activeType = examType === "Other" ? customType.trim() : examType;

  // Teachers grade only the classes and subjects they are allocated; leadership sees every class.
  const classOptions: { id: number; name: string }[] = isTeacher
    ? myClasses.filter((c) => c.subjects.length > 0).map((c) => ({ id: c.class_id, name: c.class_name }))
    : classes.map((c) => ({ id: c.id, name: c.name }));
  const subjectOptions: Subject[] = isTeacher
    ? (myClasses.find((c) => c.class_id === classId)?.subjects ?? []).map((s) => ({ id: s.subject_id, school_id: user?.school_id ?? 0, name: s.subject_name }))
    : classSubjects;
  const subjectId = subjectOptions.some((s) => s.id === pickedSubject) ? pickedSubject : (subjectOptions[0]?.id ?? null);
  const isClassTeacherHere = isTeacher && myClasses.some((c) => c.class_id === classId && c.is_homeroom_teacher);
  const showBoardLink = canConfigure || myClasses.some((c) => c.is_homeroom_teacher);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    Promise.all([
      api.listClasses(token, user.school_id),
      user.role === "teacher" ? api.listMyClasses(token, user.school_id).catch(() => [] as MyClass[]) : Promise.resolve([] as MyClass[]),
      api.listAcademicTerms(token, user.school_id),
      api.listGradingBands(token, user.school_id),
    ])
      .then(([cs, mine, ts, bs]) => {
        if (cancelled) return;
        setClasses(cs);
        setMyClasses(mine);
        setTerms(ts);
        setBands(bs);
        const current = ts.find((t) => t.is_current) ?? ts[0];
        if (current) setTerm(current.name);
        const first = user.role === "teacher" ? mine.find((c) => c.subjects.length > 0)?.class_id : cs[0]?.id;
        if (first !== undefined) setClassId(first);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, user?.role]);

  // Subjects follow the class: every learner in a class takes the subjects allocated to it.
  useEffect(() => {
    if (!token || !user?.school_id || classId === null) return;
    let cancelled = false;
    if (user.role !== "teacher") {
      api
        .listClassSubjects(token, user.school_id, classId)
        .catch(() => [] as Subject[])
        .then((ss) => {
          if (cancelled) return;
          setClassSubjects(ss);
        });
    }
    api.listStudents(token, user.school_id, classId).then((r) => !cancelled && setStudents(r));
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, user?.role, classId]);

  useEffect(() => {
    if (!token || !user?.school_id || user.role !== "teacher" || classes.length === 0) return;
    Promise.all([api.listMyClasses(token, user.school_id), api.listGradeLevels(token)])
      .then(([mine, grades]) => {
        const prePrimaryGradeIds = new Set(grades.filter((g) => g.level_group === "pre_primary").map((g) => g.id));
        const myClassIds = new Set(mine.map((c) => c.class_id));
        const teaches = classes.some((c) => myClassIds.has(c.id) && c.grade_level_id !== null && prePrimaryGradeIds.has(c.grade_level_id));
        setCanSeedPrePrimary(teaches);
      })
      .catch(() => setCanSeedPrePrimary(false));
  }, [token, user?.school_id, user?.role, classes]);

  // The marks for the chosen subject, term and exam type.
  useEffect(() => {
    if (!token || !user?.school_id || subjectId === null || !term || !activeType) return;
    let cancelled = false;
    api.listResults(token, user.school_id, { subject_id: subjectId, term, exam_type: activeType }).then((results) => {
      if (cancelled) return;
      const scoreMap: Record<number, string> = {};
      const remarkMap: Record<number, string> = {};
      const locked = new Set<number>();
      for (const r of results) {
        scoreMap[r.student_id] = String(r.score);
        if (r.remarks) remarkMap[r.student_id] = r.remarks;
        // A class teacher can see everyone's marks but not change another teacher's.
        if (isClassTeacherHere && r.recorded_by !== null && r.recorded_by !== user.id) locked.add(r.student_id);
      }
      setScores(scoreMap);
      setOriginal(scoreMap);
      setRemarks(remarkMap);
      setLockedIds(locked);
    });
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, user?.id, subjectId, term, activeType, isClassTeacherHere]);

  async function handleSeedLearningAreas() {
    if (!token || !user?.school_id) return;
    setSeeding(true);
    try {
      const seeded = await api.seedPrePrimaryLearningAreas(token, user.school_id);
      void seeded;
      toast.success("Official PP1/PP2 learning areas added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add learning areas");
    } finally {
      setSeeding(false);
    }
  }

  async function handleSaveScores() {
    if (!token || !user?.school_id || subjectId === null) return;
    if (!activeType) {
      toast.error("Type the name of the exam first");
      return;
    }
    setSaving(true);
    try {
      // Only what changed is sent, so marks other teachers entered are never re-submitted.
      const entries = Object.entries(scores).filter(([id, v]) => v !== "" && v !== original[Number(id)] && !lockedIds.has(Number(id)));
      for (const [studentId, score] of entries) {
        await api.upsertResult(token, user.school_id, {
          student_id: Number(studentId),
          subject_id: subjectId,
          term,
          exam_type: activeType,
          score: Number(score),
          remarks: remarks[Number(studentId)] || undefined,
        });
      }
      setOriginal({ ...scores });
      toast.success(entries.length ? `${activeType} marks saved` : "Nothing new to save");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save grades");
    } finally {
      setSaving(false);
    }
  }

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const nums: number[] = [];
    for (const s of students) {
      const v = scores[s.id];
      if (v === undefined || v === "" || Number.isNaN(Number(v))) continue;
      nums.push(Number(v));
      const level = levelForScore(Number(v), bands);
      if (level) counts[level.level_code] = (counts[level.level_code] ?? 0) + 1;
    }
    return {
      counts,
      entered: nums.length,
      average: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
      highest: nums.length ? Math.max(...nums) : null,
      lowest: nums.length ? Math.min(...nums) : null,
    };
  }, [students, scores, bands]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Grading" description="CBC Assessment" />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Grading"
        description={`CBC Assessment · ${term || "No term set"}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {showBoardLink && (
              <Button nativeButton={false} render={<Link href={classId ? `/dashboard/results/board?class_id=${classId}` : "/dashboard/results/board"}><LayoutList /> Class results board</Link>} />
            )}
            {canConfigure && <GradingBandsDialog bands={bands} onSaved={setBands} />}
          </div>
        }
      />

      <DepartmentPulse dept="results" />

      {!canRecord && !isTeacher && <ViewOnly>Teachers record marks for the subjects they teach. You see every mark and the class results boards.</ViewOnly>}

      {canConfigure && (
        <div role="tablist" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
          {([["performance", "Class performance"], ["gradebook", "Marks by subject"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`h-9 rounded-md px-4 text-sm font-medium transition-colors ${view === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
      )}
      {canConfigure && view === "performance" && user?.school_id && <ClassPerformance schoolId={user.school_id} terms={terms} />}
      {(!canConfigure || view === "gradebook") && (
        <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {bands.map((b, i) => (
          <Card key={b.id} className={`border ${BAND_STYLES[i % BAND_STYLES.length]}`}>
            <CardContent className="flex flex-col gap-1 pt-4">
              <span className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase opacity-70">
                {b.level_code}
                <span className="rounded-full bg-background/60 px-2 py-0.5 text-[11px] tabular-nums normal-case" title="Learners at this level for the marks shown below">
                  {levelCounts.counts[b.level_code] ?? 0} learner{(levelCounts.counts[b.level_code] ?? 0) === 1 ? "" : "s"}
                </span>
              </span>
              <span className="text-sm font-medium">{b.label}</span>
              <span className="text-xs opacity-80">
                {Number(b.min_score)}–{Number(b.max_score)} · {b.points} pts
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {canConfigure && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Subjects are managed in their own module, where each one is tied to the grades it is taught in.
          <Link href="/dashboard/subjects" className="font-medium text-primary hover:underline">Open Subjects</Link>
        </p>
      )}
      {!canConfigure && canSeedPrePrimary && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Button type="button" variant="outline" onClick={handleSeedLearningAreas} disabled={seeding}>
               {seeding ? "Adding..." : "Add official PP1/PP2 learning areas"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Gradebook</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>{classOptions.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Select value={subjectId ? String(subjectId) : ""} onValueChange={(v) => v && setPickedSubject(Number(v))}>
                <SelectTrigger className="w-44"><SelectValue placeholder="No subjects" /></SelectTrigger>
                <SelectContent>{subjectOptions.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Term</Label>
              {terms.length > 0 ? (
                <Select value={term} onValueChange={(v) => v && setTerm(v)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Add a term first" className="w-44" />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Exam type</Label>
              <Select value={examType} onValueChange={(v) => v && setExamType(v)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{EXAM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {examType === "Other" && (
              <div className="grid gap-1.5">
                <Label>Exam name</Label>
                <Input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="e.g. Mock 2" className="w-44" />
              </div>
            )}
            {canRecord && (
              <Button onClick={handleSaveScores} disabled={saving || students.length === 0 || subjectId === null}>
                <Save /> {saving ? "Saving..." : "Save grades"}
              </Button>
            )}
          </div>

          {classOptions.length === 0 ? (
            <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {isTeacher ? "You have not been allocated any subject to teach yet." : "No classes yet."}
            </p>
          ) : subjectOptions.length === 0 ? (
            <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              No subjects have been allocated to this class yet. The head of institution allocates them under Teaching Assignments, and every learner in the class then takes them automatically.
            </p>
          ) : (
            levelCounts.entered > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span>Marked: <strong className="text-foreground">{levelCounts.entered}</strong> of {students.length}</span>
                <span>Average: <strong className="text-foreground">{levelCounts.average?.toFixed(1)}</strong></span>
                <span>Highest: <strong className="text-foreground">{levelCounts.highest}</strong></span>
                <span>Lowest: <strong className="text-foreground">{levelCounts.lowest}</strong></span>
              </div>
            )
          )}
          {isClassTeacherHere && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Lock className="size-3.5" /> As class teacher you can see every mark, but marks entered by another subject teacher are locked.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead className="w-28">Score / 100</TableHead>
              <TableHead className="w-28">Level</TableHead>
              <TableHead>Teacher comment</TableHead>
              <TableHead className="text-right">Report Card</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => {
              const scoreValue = scores[s.id];
              const level = scoreValue !== undefined && scoreValue !== "" ? levelForScore(Number(scoreValue), bands) : null;
              const locked = lockedIds.has(s.id);
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback>{initials(s.first_name, s.last_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{s.first_name} {s.last_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{s.admission_number}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canRecord && !locked ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreValue ?? ""}
                        onChange={(e) => setScores((sc) => ({ ...sc, [s.id]: e.target.value }))}
                        className="w-24"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm">{locked && <Lock className="size-3.5 text-muted-foreground" aria-label="Entered by the subject teacher" />}{scoreValue || "—"}</span>
                    )}
                  </TableCell>
                  <TableCell>{level && <Badge variant="secondary">{level.level_code}</Badge>}</TableCell>
                  <TableCell>
                    {canRecord && !locked ? (
                      <Input
                        value={remarks[s.id] ?? ""}
                        onChange={(e) => setRemarks((r) => ({ ...r, [s.id]: e.target.value }))}
                        placeholder="Optional comment"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{remarks[s.id] || "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canConfigure && !canRecord && scoreValue !== undefined && scoreValue !== "" && (
                        <Button variant="outline" size="sm" className="h-9" onClick={() => setFixing(s)}><Pencil /> Correct</Button>
                      )}
                      <Button variant="outline" size="sm" className="h-9" nativeButton={false} render={<Link href={`/dashboard/report-card/${s.id}`}><FileText /> View</Link>} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No students in this class.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
        </>
      )}
      {fixing && subjectId !== null && (
        <CorrectMarkDialog
          student={fixing}
          current={scores[fixing.id] ?? ""}
          onClose={() => setFixing(null)}
          onSave={async (score, reason) => {
            if (!token || !user?.school_id) return;
            try {
              await api.overrideMark(token, user.school_id, { student_id: fixing.id, subject_id: subjectId, term, exam_type: activeType, score, reason });
              setScores((sc) => ({ ...sc, [fixing.id]: String(score) }));
              setOriginal((sc) => ({ ...sc, [fixing.id]: String(score) }));
              toast.success("Mark corrected. The teacher has been told.");
              setFixing(null);
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "We couldn't save the correction.");
            }
          }}
        />
      )}
    </div>
  );
}
