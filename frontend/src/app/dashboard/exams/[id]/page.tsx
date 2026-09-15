"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Printer } from "lucide-react";
import { api, ApiError, ExamDetail, ExamSubmissionDetail, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

function GradeCell({ answer, maxMarks, onGrade }: { answer: ExamSubmissionDetail["answers"][number]; maxMarks: number; onGrade: (marks: number) => void }) {
  const [value, setValue] = useState(answer.awarded_marks?.toString() ?? "");

  if (answer.awarded_marks !== null) {
    return <Badge className="gap-1"><CheckCircle2 className="size-3" /> {answer.awarded_marks}/{maxMarks}</Badge>;
  }

  return (
    <div className="flex items-center gap-2">
      <Input type="number" min={0} max={maxMarks} step="0.5" value={value} onChange={(e) => setValue(e.target.value)} className="w-20" />
      <Button size="sm" onClick={() => value !== "" && onGrade(Number(value))}>Grade</Button>
    </div>
  );
}

export default function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [submissions, setSubmissions] = useState<ExamSubmissionDetail[]>([]);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && !["school_admin", "teacher", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.getExam(token, user.school_id, Number(id)).then(setExam),
      api.listSubjects(token, user.school_id).then(setSubjects),
      api.listExamSubmissions(token, user.school_id, Number(id)).then(setSubmissions),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id, id]);

  async function handleGrade(submissionId: number, answerId: number, marks: number) {
    if (!token || !user?.school_id) return;
    try {
      const updated = await api.gradeExamAnswer(token, user.school_id, Number(id), submissionId, answerId, marks);
      setSubmissions((subs) => subs.map((s) => (s.id === submissionId ? updated : s)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save grade");
    }
  }

  if (loading || dataLoading) return <PageLoader />;
  if (!exam) return <p className="text-sm text-muted-foreground">Exam not found.</p>;

  const subjectName = subjects.find((s) => s.id === exam.subject_id)?.name ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <PageHeader title={exam.title} description={`${subjectName} · ${exam.term} · ${exam.duration_minutes} minutes · ${exam.total_marks} marks`} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showAnswerKey} onCheckedChange={setShowAnswerKey} /> Show answer key
          </label>
          <Button onClick={() => window.print()}><Printer /> Print</Button>
        </div>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardContent className="pt-6">
          <div className="mb-6 hidden text-center print:block">
            <h1 className="text-xl font-semibold">{exam.title}</h1>
            <p className="text-sm text-muted-foreground">{subjectName} · {exam.term} · {exam.duration_minutes} minutes · {exam.total_marks} marks</p>
          </div>
          <div className="flex flex-col gap-6">
            {exam.questions.map((q, i) => (
              <div key={q.id}>
                <p className="font-medium">
                  {i + 1}. {q.question_text} <span className="text-xs text-muted-foreground">({q.marks} marks)</span>
                </p>
                {q.question_type === "mcq" && q.options && (
                  <ul className="mt-2 flex flex-col gap-1 pl-4 text-sm">
                    {q.options.map((opt, oi) => (
                      <li key={oi} className={showAnswerKey && oi === q.correct_option_index ? "font-semibold text-emerald-600" : ""}>
                        {String.fromCharCode(65 + oi)}. {opt}
                        {showAnswerKey && oi === q.correct_option_index && " ✓"}
                      </li>
                    ))}
                  </ul>
                )}
                {q.question_type === "short_answer" && (
                  <div className="mt-2 h-16 rounded border border-dashed" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader><CardTitle className="text-base">Submissions</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">{s.student_name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{s.status.replace("_", " ")}</Badge>
                  {s.score !== null && <Badge>{s.score}/{exam.total_marks}</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {s.answers.map((a) => {
                  const question = exam.questions.find((q) => q.id === a.question_id);
                  if (!question) return null;
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{question.question_text}: {a.answer_text}</span>
                      {question.question_type === "short_answer" ? (
                        <GradeCell answer={a} maxMarks={question.marks} onGrade={(marks) => handleGrade(s.id, a.id, marks)} />
                      ) : (
                        <Badge variant="outline">{a.awarded_marks}/{question.marks}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {submissions.length === 0 && <p className="text-sm text-muted-foreground">No students have sat this exam yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
