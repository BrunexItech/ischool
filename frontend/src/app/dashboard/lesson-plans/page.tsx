"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { BookOpen, Plus } from "lucide-react";
import { api, ApiError, LessonPlan, SchoolClass, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LessonPlansPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ classId: "", subjectId: "", term: "" });

  useEffect(() => {
    if (!loading && user && !["school_admin", "teacher", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listLessonPlans(token, user.school_id).then(setPlans),
      api.listClasses(token, user.school_id).then(setClasses),
      api.listSubjects(token, user.school_id).then(setSubjects),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.classId || !form.subjectId || !form.term) return;
    setSubmitting(true);
    try {
      const created = await api.createLessonPlan(token, user.school_id, {
        class_id: Number(form.classId),
        subject_id: Number(form.subjectId),
        term: form.term,
      });
      setPlans((p) => [created, ...p]);
      toast.success("Lesson plan created");
      router.push(`/dashboard/lesson-plans/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create lesson plan");
    } finally {
      setSubmitting(false);
    }
  }

  const className = (id: number) => classes.find((c) => c.id === id)?.name ?? "—";
  const subjectName = (id: number) => subjects.find((s) => s.id === id)?.name ?? "—";

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Lesson Plans" description="Plan a whole term — fill it in now, or build it up week by week." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Lesson Plans" description="Plan a whole term — fill it in now, or build it up week by week." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4.5" /> Start a new plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Select value={form.subjectId} onValueChange={(v) => v && setForm((f) => ({ ...f, subjectId: v }))}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Term</Label>
              <Input required placeholder="e.g. Term 1 2026" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} className="w-44" />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Creating..." : "Create plan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All plans</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/lesson-plans/${p.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-4.5" /></div>
                <div>
                  <p className="font-medium">{subjectName(p.subject_id)} — {className(p.class_id)}</p>
                  <p className="text-xs text-muted-foreground">{p.term}</p>
                </div>
              </div>
              <Badge variant="secondary">{p.completed_count}/{p.entry_count} covered</Badge>
            </Link>
          ))}
          {plans.length === 0 && <p className="text-sm text-muted-foreground">No lesson plans yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
