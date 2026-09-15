"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Plus, Trash2 } from "lucide-react";
import { api, ApiError, Exam, ExamQuestionType, SchoolClass, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_CLASS = "all";

interface DraftQuestion {
  question_text: string;
  question_type: ExamQuestionType;
  marks: string;
  options: string[];
  correct_option_index: number | null;
}

function emptyQuestion(): DraftQuestion {
  return { question_text: "", question_type: "mcq", marks: "5", options: ["", ""], correct_option_index: null };
}

export default function ExamsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ subjectId: "", classId: NO_CLASS, title: "", term: "", duration: "60" });
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);

  useEffect(() => {
    if (!loading && user && !["school_admin", "teacher", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  function refresh() {
    if (!token || !user?.school_id) return;
    api.listExams(token, user.school_id).then(setExams);
  }

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listExams(token, user.school_id).then(setExams),
      api.listSubjects(token, user.school_id).then(setSubjects),
      api.listClasses(token, user.school_id).then(setClasses),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(qIndex: number, optIndex: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === qIndex ? { ...q, options: q.options.map((o, oi) => (oi === optIndex ? value : o)) } : q))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.subjectId || !form.title || !form.term) return;

    for (const q of questions) {
      if (!q.question_text.trim()) {
        toast.error("Every question needs its text filled in");
        return;
      }
      if (q.question_type === "mcq" && (q.correct_option_index === null || q.options.some((o) => !o.trim()))) {
        toast.error("Every MCQ option needs text, and a correct answer must be selected");
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await api.createExam(token, user.school_id, {
        subject_id: Number(form.subjectId),
        class_id: form.classId === NO_CLASS ? undefined : Number(form.classId),
        title: form.title,
        term: form.term,
        duration_minutes: Number(form.duration),
        questions: questions.map((q, i) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          marks: Number(q.marks),
          order: i + 1,
          options: q.question_type === "mcq" ? q.options : undefined,
          correct_option_index: q.question_type === "mcq" ? q.correct_option_index ?? undefined : undefined,
        })),
      });
      setExams((e) => [created, ...e]);
      setForm({ subjectId: "", classId: NO_CLASS, title: "", term: "", duration: "60" });
      setQuestions([emptyQuestion()]);
      toast.success(`${created.title} created`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create exam");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePublish(exam: Exam) {
    if (!token || !user?.school_id) return;
    const updated = await api.setExamPublished(token, user.school_id, exam.id, !exam.is_published);
    setExams((es) => es.map((e) => (e.id === exam.id ? updated : e)));
  }

  async function handleDelete(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteExam(token, user.school_id, id);
      setExams((es) => es.filter((e) => e.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete exam");
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  const subjectName = (id: number) => subjects.find((s) => s.id === id)?.name ?? "—";
  const className = (id: number | null) => (id ? classes.find((c) => c.id === id)?.name ?? "—" : "All classes");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Exams" description="Set an exam, print it for a paper sitting, or publish it for students to sit online." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4.5" /> Set a new exam</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Subject</Label>
                <Select value={form.subjectId} onValueChange={(v) => v && setForm((f) => ({ ...f, subjectId: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Class</Label>
                <Select value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CLASS}>All classes</SelectItem>
                    {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Term</Label>
                <Input required placeholder="e.g. Term 1 2026" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Duration (minutes)</Label>
                <Input required type="number" min={1} value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="grid flex-1 gap-1.5">
                      <Label>Question {i + 1}</Label>
                      <Input required value={q.question_text} onChange={(e) => updateQuestion(i, { question_text: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Type</Label>
                      <Select value={q.question_type} onValueChange={(v) => v && updateQuestion(i, { question_type: v as ExamQuestionType })}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple choice</SelectItem>
                          <SelectItem value="short_answer">Short answer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Marks</Label>
                      <Input required type="number" min={1} value={q.marks} onChange={(e) => updateQuestion(i, { marks: e.target.value })} className="w-24" />
                    </div>
                    {questions.length > 1 && (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>

                  {q.question_type === "mcq" && (
                    <div className="grid gap-2 pl-4 sm:grid-cols-2">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2 text-sm">
                          <input type="radio" checked={q.correct_option_index === oi} onChange={() => updateQuestion(i, { correct_option_index: oi })} />
                          <Input placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => updateOption(i, oi, e.target.value)} />
                        </label>
                      ))}
                      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => updateQuestion(i, { options: [...q.options, ""] })}>
                        <Plus /> Add option
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}>
                <Plus /> Add question
              </Button>
            </div>

            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Create exam"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All exams</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {exams.map((exam) => (
            <div key={exam.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{exam.title}</p>
                <p className="text-xs text-muted-foreground">
                  {subjectName(exam.subject_id)} · {className(exam.class_id)} · {exam.term} · {exam.duration_minutes} min · {exam.total_marks} marks · {exam.question_count} questions
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={exam.is_published} onCheckedChange={() => handleTogglePublish(exam)} />
                  {exam.is_published ? "Published" : "Draft"}
                </label>
                <Button variant="outline" size="sm" render={<Link href={`/dashboard/exams/${exam.id}`}><FileText /> View / Print</Link>} />
                {(user?.role === "school_admin" || user?.role === "super_admin") && (
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(exam.id)}><Trash2 /></Button>
                )}
              </div>
            </div>
          ))}
          {exams.length === 0 && <p className="text-sm text-muted-foreground">No exams set yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
