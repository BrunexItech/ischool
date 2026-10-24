"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, AcademicTerm, ApiError, GradingBand, SchoolClass, Student, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Pencil, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";

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

export default function ResultsPage() {
  const { user, token } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [term, setTerm] = useState("");
  const [bands, setBands] = useState<GradingBand[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [canSeedPrePrimary, setCanSeedPrePrimary] = useState(false);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [newSubject, setNewSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(true);

  const canConfigure = user?.role === "super_admin" || user?.role === "head_of_institution" || user?.role === "group_principal";

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listClasses(token, user.school_id).then((cs) => {
        setClasses(cs);
        if (cs.length > 0) setClassId(cs[0].id);
      }),
      api.listSubjects(token, user.school_id).then((ss) => {
        setSubjects(ss);
        if (ss.length > 0) setSubjectId(ss[0].id);
      }),
      api.listAcademicTerms(token, user.school_id).then((ts) => {
        setTerms(ts);
        const current = ts.find((t) => t.is_current) ?? ts[0];
        if (current) setTerm(current.name);
      }),
      api.listGradingBands(token, user.school_id).then(setBands),
    ]).finally(() => setLoading(false));
  }, [token, user?.school_id]);

  useEffect(() => {
    if (!token || !user?.school_id || classId === null) return;
    api.listStudents(token, user.school_id, classId).then(setStudents);
  }, [token, user?.school_id, classId]);

  useEffect(() => {
    if (!token || !user?.school_id || user.role !== "teacher" || classes.length === 0) return;
    Promise.all([api.listMyClasses(token, user.school_id), api.listGradeLevels(token)])
      .then(([myClasses, grades]) => {
        const prePrimaryGradeIds = new Set(grades.filter((g) => g.level_group === "pre_primary").map((g) => g.id));
        const myClassIds = new Set(myClasses.map((c) => c.class_id));
        const teaches = classes.some((c) => myClassIds.has(c.id) && c.grade_level_id !== null && prePrimaryGradeIds.has(c.grade_level_id));
        setCanSeedPrePrimary(teaches);
      })
      .catch(() => setCanSeedPrePrimary(false));
  }, [token, user?.school_id, user?.role, classes]);

  useEffect(() => {
    if (!token || !user?.school_id || subjectId === null || !term) return;
    api.listResults(token, user.school_id, { subject_id: subjectId, term }).then((results) => {
      const scoreMap: Record<number, string> = {};
      const remarkMap: Record<number, string> = {};
      for (const r of results) {
        scoreMap[r.student_id] = String(r.score);
        if (r.remarks) remarkMap[r.student_id] = r.remarks;
      }
      setScores(scoreMap);
      setRemarks(remarkMap);
    });
  }, [token, user?.school_id, subjectId, term]);

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !newSubject.trim()) return;
    const subject = await api.createSubject(token, user.school_id, newSubject.trim());
    setSubjects((s) => [...s, subject]);
    setSubjectId(subject.id);
    setNewSubject("");
    toast.success(`${subject.name} added`);
  }

  async function handleSeedLearningAreas() {
    if (!token || !user?.school_id) return;
    setSeeding(true);
    try {
      const seeded = await api.seedPrePrimaryLearningAreas(token, user.school_id);
      setSubjects((s) => {
        const existingNames = new Set(s.map((x) => x.name));
        return [...s, ...seeded.filter((x) => !existingNames.has(x.name))];
      });
      toast.success("Official PP1/PP2 learning areas added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add learning areas");
    } finally {
      setSeeding(false);
    }
  }

  async function handleSaveScores() {
    if (!token || !user?.school_id || subjectId === null) return;
    setSaving(true);
    try {
      const entries = Object.entries(scores).filter(([, v]) => v !== "");
      for (const [studentId, score] of entries) {
        await api.upsertResult(token, user.school_id, {
          student_id: Number(studentId),
          subject_id: subjectId,
          term,
          score: Number(score),
          remarks: remarks[Number(studentId)] || undefined,
        });
      }
      toast.success("Grades saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save grades");
    } finally {
      setSaving(false);
    }
  }

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
        action={canConfigure && <GradingBandsDialog bands={bands} onSaved={setBands} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {bands.map((b, i) => (
          <Card key={b.id} className={`border ${BAND_STYLES[i % BAND_STYLES.length]}`}>
            <CardContent className="flex flex-col gap-1 pt-4">
              <span className="text-xs font-semibold tracking-wide uppercase opacity-70">{b.level_code}</span>
              <span className="text-sm font-medium">{b.label}</span>
              <span className="text-xs opacity-80">
                {Number(b.min_score)}–{Number(b.max_score)} · {b.points} pts
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-end gap-3 pt-6">
          <form onSubmit={handleAddSubject} className="flex items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Add subject</Label>
              <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. English" className="w-48" />
            </div>
            <Button type="submit" variant="secondary"><Plus /> Add</Button>
          </form>
          {canSeedPrePrimary && (
            <Button type="button" variant="outline" onClick={handleSeedLearningAreas} disabled={seeding}>
              <Sparkles /> {seeding ? "Adding..." : "Add official PP1/PP2 learning areas"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gradebook</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Subject</Label>
            <Select value={subjectId ? String(subjectId) : ""} onValueChange={(v) => v && setSubjectId(Number(v))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Assessment</Label>
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
          <Button onClick={handleSaveScores} disabled={saving || students.length === 0 || subjectId === null}>
            <Save /> {saving ? "Saving..." : "Save grades"}
          </Button>
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
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={scoreValue ?? ""}
                      onChange={(e) => setScores((sc) => ({ ...sc, [s.id]: e.target.value }))}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>{level && <Badge variant="secondary">{level.level_code}</Badge>}</TableCell>
                  <TableCell>
                    <Input
                      value={remarks[s.id] ?? ""}
                      onChange={(e) => setRemarks((r) => ({ ...r, [s.id]: e.target.value }))}
                      placeholder="Optional comment"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" render={<Link href={`/dashboard/report-card/${s.id}`}><FileText /> View</Link>} />
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
    </div>
  );
}
