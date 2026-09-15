"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock } from "lucide-react";
import { api, ApiError, ExamForStudent, ExamSubmission } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [exam, setExam] = useState<ExamForStudent | null>(null);
  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamSubmission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!loading && user && user.role !== "student") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.getMyStudentRecord(token).then((s) => setStudentId(s.id)).catch(() => setStudentId(null));
  }, [token]);

  useEffect(() => {
    if (!token || !studentId) return;
    api
      .startExam(token, studentId, Number(id))
      .then(({ exam, submission }) => {
        setExam(exam);
        setSubmission(submission);
        const elapsed = (Date.now() - new Date(submission.started_at).getTime()) / 1000;
        setRemaining(Math.max(0, exam.duration_minutes * 60 - elapsed));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load this exam"));
  }, [token, studentId, id]);

  async function handleSubmit() {
    if (!token || !studentId || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const payload = Object.entries(answers).map(([qid, text]) => ({ question_id: Number(qid), answer_text: text }));
      const submitted = await api.submitExam(token, studentId, Number(id), payload);
      setResult(submitted);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to submit exam");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!submission || result) return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submission, result]);

  if (loading || (!error && !exam)) return <PageLoader />;

  if (error) {
    return (
      <Card className="mx-auto mt-12 max-w-md">
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => router.push("/dashboard/my-records")}>Back to my records</Button>
        </CardContent>
      </Card>
    );
  }

  if (result) {
    return (
      <Card className="mx-auto mt-12 max-w-md">
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <p className="font-medium">Exam submitted</p>
          <p className="text-sm text-muted-foreground">
            {result.status === "graded" ? `Your score: ${result.score} / ${exam?.total_marks}` : "Your teacher will grade the remaining questions soon."}
          </p>
          <Button onClick={() => router.push("/dashboard/my-records")}>Back to my records</Button>
        </CardContent>
      </Card>
    );
  }

  if (!exam) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{exam.title}</CardTitle>
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Clock className="size-4" /> {formatTime(Math.floor(remaining))}
          </div>
        </CardHeader>
      </Card>

      {exam.questions.map((q, i) => (
        <Card key={q.id}>
          <CardContent className="flex flex-col gap-3 pt-6">
            <p className="font-medium">{i + 1}. {q.question_text} <span className="text-xs text-muted-foreground">({q.marks} marks)</span></p>
            {q.question_type === "mcq" && q.options ? (
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === String(oi)}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: String(oi) }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <Textarea
                rows={4}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              />
            )}
          </CardContent>
        </Card>
      ))}

      <Button onClick={handleSubmit} disabled={submitting} className="w-fit">
        {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Submitting..." : "Submit exam"}
      </Button>
    </div>
  );
}
