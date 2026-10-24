"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileUp, NotebookPen, X } from "lucide-react";
import { api, ApiError, HomeworkListItem, SchoolClass, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HOMEWORK_TYPES = ["Assignment", "Project", "Classwork", "Revision", "Reading", "Other"];

export default function HomeworkPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [items, setItems] = useState<HomeworkListItem[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    classId: "",
    subjectId: "",
    title: "",
    type: "Assignment",
    customType: "",
    instructions: "",
    dueDate: "",
    allowDigital: true,
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listHomework(token, user.school_id).then(setItems),
      api.listClasses(token, user.school_id).then(setClasses),
      api.listSubjects(token, user.school_id).then(setSubjects),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  function className(id: number) {
    return classes.find((c) => c.id === id)?.name ?? `#${id}`;
  }
  function subjectName(id: number) {
    return subjects.find((s) => s.id === id)?.name ?? `#${id}`;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.classId || !form.subjectId || !form.title || !form.dueDate) return;
    setSubmitting(true);
    try {
      let created = await api.createHomework(token, user.school_id, {
        class_id: Number(form.classId),
        subject_id: Number(form.subjectId),
        title: form.title,
        homework_type: form.type === "Other" ? form.customType.trim() || "Other" : form.type,
        instructions: form.instructions || undefined,
        due_date: form.dueDate,
        allow_digital_submission: form.allowDigital,
      });
      if (file) {
        created = await api.uploadHomeworkAttachment(token, user.school_id, created.id, file);
      }
      setItems((it) => [created, ...it]);
      setForm({ classId: "", subjectId: "", title: "", type: "Assignment", customType: "", instructions: "", dueDate: "", allowDigital: true });
      setFile(null);
      toast.success("Homework posted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to post homework");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Homework" description="Post homework for a class and track who's done it." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Homework" description="Post homework for a class and track who's done it." />

      <Card>
        <CardHeader><CardTitle className="text-base">Post homework</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <div className="grid gap-1.5">
                <Label>Class</Label>
                <Select required value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Subject</Label>
                <Select required value={form.subjectId} onValueChange={(v) => v && setForm((f) => ({ ...f, subjectId: v }))}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Due date</Label>
                <Input required type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="w-44" />
              </div>
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOMEWORK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.type === "Other" && (
                <div className="grid gap-1.5">
                  <Label>Custom type</Label>
                  <Input placeholder="e.g. Science Fair" value={form.customType} onChange={(e) => setForm((f) => ({ ...f, customType: e.target.value }))} className="w-44" />
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Title</Label>
              <Input required placeholder="e.g. Read Chapter 3 and answer the questions" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Instructions (optional)</Label>
              <Textarea rows={3} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Attach a worksheet (optional) — PDF or photo</Label>
              {file ? (
                <div className="flex w-fit items-center gap-2 rounded-lg border p-2 pl-3 text-sm">
                  <FileUp className="size-4 text-muted-foreground" />
                  <span className="max-w-56 truncate">{file.name}</span>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFile(null)}><X /></Button>
                </div>
              ) : (
                <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-fit" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.allowDigital} onCheckedChange={(v) => setForm((f) => ({ ...f, allowDigital: v }))} />
              <Label className="font-normal">Allow students to submit a photo online (otherwise it&apos;s checked in the exercise book at school)</Label>
            </div>
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Posting..." : "Post homework"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {items.map((hw) => (
          <Link
            key={hw.id}
            href={`/dashboard/homework/${hw.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><NotebookPen className="size-4.5" /></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium">{hw.title}</p>
                  <Badge variant="outline">{hw.homework_type}</Badge>
                  {hw.attachment_url && <FileUp className="size-3.5 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subjectName(hw.subject_id)} — {className(hw.class_id)} · Due {new Date(hw.due_date + "T12:00:00").toLocaleDateString()}
                  {hw.created_by_name ? ` · ${hw.created_by_name}` : ""}
                </p>
              </div>
            </div>
            <Badge variant="secondary">{hw.submitted_count}/{hw.total_students} submitted</Badge>
          </Link>
        ))}
        {items.length === 0 && (
          <Card><CardContent className="flex h-24 items-center justify-center text-sm text-muted-foreground">No homework posted yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
