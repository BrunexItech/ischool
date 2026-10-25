"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Plus, Trash2, Wand2 } from "lucide-react";
import { api, ApiError, LessonPlanDetail, LessonPlanEntry } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function EditEntryDialog({ schoolId, planId, entry, onUpdated }: { schoolId: number; planId: number; entry: LessonPlanEntry; onUpdated: (e: LessonPlanEntry) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    label: entry.label,
    scheduled_date: entry.scheduled_date ?? "",
    topic: entry.topic,
    objectives: entry.objectives ?? "",
    resources: entry.resources ?? "",
    notes: entry.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.updateLessonPlanEntry(token, schoolId, planId, entry.id, {
        ...form,
        scheduled_date: form.scheduled_date || undefined,
      });
      onUpdated(updated);
      setOpen(false);
      toast.success("Entry updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Edit entry</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Label</Label>
              <Input required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Date (optional)</Label>
              <Input type="date" value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Topic</Label>
            <Input required value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Objectives (optional)</Label>
            <Textarea rows={2} value={form.objectives} onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Resources (optional)</Label>
            <Textarea rows={2} value={form.resources} onChange={(e) => setForm((f) => ({ ...f, resources: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkFillDialog({ schoolId, planId, nextOrder, onReplaced }: { schoolId: number; planId: number; nextOrder: number; onReplaced: (plan: LessonPlanDetail) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [weekCount, setWeekCount] = useState("13");
  const [submitting, setSubmitting] = useState(false);

  function generateWeeks() {
    const n = Math.max(1, Math.min(52, Number(weekCount) || 0));
    const lines = Array.from({ length: n }, (_, i) => `Week ${nextOrder + i} | `);
    setText(lines.join("\n"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const entries = lines.map((line, i) => {
      const [label, ...rest] = line.split("|");
      return { order: nextOrder + i, label: label.trim() || `Week ${nextOrder + i}`, topic: rest.join("|").trim() || label.trim() };
    });
    if (entries.length === 0) return;
    setSubmitting(true);
    try {
      const updated = await api.replaceLessonPlanEntries(token, schoolId, planId, entries);
      onReplaced(updated);
      setText("");
      setOpen(false);
      toast.success(`Set ${entries.length} entries for the whole plan`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to set entries");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Fill the whole term at once</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Fill the whole term at once</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          One line per week: <code>Label | Topic</code>. This replaces every entry currently in the plan.
        </p>
        <div className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Weeks in this term</Label>
            <Input type="number" min={1} max={52} value={weekCount} onChange={(e) => setWeekCount(e.target.value)} className="w-24" />
          </div>
          <Button type="button" variant="outline" onClick={generateWeeks}><Wand2 /> Generate week rows</Button>
        </div>
        <Textarea
          rows={10}
          placeholder={"Week 1 | Introduction to Algebra\nWeek 2 | Linear Equations\nWeek 3 | Quadratic Equations"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Replace all entries"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function LessonPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const canRecord = user?.role === "super_admin" || user?.role === "teacher" || user?.role === "staff";
  const [plan, setPlan] = useState<LessonPlanDetail | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [addForm, setAddForm] = useState({ label: "", scheduled_date: "", topic: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.getLessonPlan(token, user.school_id, Number(id)).then(setPlan).finally(() => setDataLoading(false));
  }, [token, user?.school_id, id]);

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !plan || !addForm.label || !addForm.topic) return;
    setAdding(true);
    try {
      const entry = await api.addLessonPlanEntry(token, user.school_id, plan.id, {
        order: (plan.entries[plan.entries.length - 1]?.order ?? 0) + 1,
        label: addForm.label,
        scheduled_date: addForm.scheduled_date || undefined,
        topic: addForm.topic,
      });
      setPlan((p) => (p ? { ...p, entries: [...p.entries, entry], entry_count: p.entry_count + 1 } : p));
      setAddForm({ label: "", scheduled_date: "", topic: "" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add entry");
    } finally {
      setAdding(false);
    }
  }

  async function toggleStatus(entry: LessonPlanEntry) {
    if (!token || !user?.school_id || !plan) return;
    const next = entry.status === "completed" ? "planned" : "completed";
    const updated = await api.updateLessonPlanEntry(token, user.school_id, plan.id, entry.id, { status: next });
    setPlan((p) =>
      p ? { ...p, entries: p.entries.map((e) => (e.id === entry.id ? updated : e)), completed_count: p.completed_count + (next === "completed" ? 1 : -1) } : p
    );
  }

  async function handleDeleteEntry(entryId: number) {
    if (!token || !user?.school_id || !plan) return;
    await api.deleteLessonPlanEntry(token, user.school_id, plan.id, entryId);
    setPlan((p) => (p ? { ...p, entries: p.entries.filter((e) => e.id !== entryId), entry_count: p.entry_count - 1 } : p));
  }

  function handleEntryUpdated(updated: LessonPlanEntry) {
    setPlan((p) => (p ? { ...p, entries: p.entries.map((e) => (e.id === updated.id ? updated : e)) } : p));
  }

  function handleReplaced(updated: LessonPlanDetail) {
    setPlan(updated);
  }

  if (loading || dataLoading) return <PageLoader />;
  if (!plan) return <p className="text-sm text-muted-foreground">Lesson plan not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={plan.term}
        description={`${plan.completed_count} of ${plan.entry_count} entries covered so far${plan.created_by_name ? ` · set up by ${plan.created_by_name}` : ""}`}
      />

      {canRecord && (
      <div className="flex flex-wrap gap-3">
        <BulkFillDialog schoolId={plan.school_id} planId={plan.id} nextOrder={(plan.entries[plan.entries.length - 1]?.order ?? 0) + 1} onReplaced={handleReplaced} />
      </div>
      )}

      {canRecord && (
      <Card>
        <CardHeader><CardTitle className="text-base">Add one entry</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAddEntry} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Label</Label>
              <Input required placeholder="e.g. Week 1" value={addForm.label} onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))} className="w-36" />
            </div>
            <div className="grid gap-1.5">
              <Label>Date (optional)</Label>
              <Input type="date" value={addForm.scheduled_date} onChange={(e) => setAddForm((f) => ({ ...f, scheduled_date: e.target.value }))} className="w-40" />
            </div>
            <div className="grid flex-1 gap-1.5">
              <Label>Topic</Label>
              <Input required value={addForm.topic} onChange={(e) => setAddForm((f) => ({ ...f, topic: e.target.value }))} />
            </div>
            <Button type="submit" disabled={adding}><Plus /> {adding ? "Adding..." : "Add"}</Button>
          </form>
        </CardContent>
      </Card>
      )}

      <div className="flex flex-col gap-3">
        {plan.entries.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
              <div className="flex items-start gap-3">
                {canRecord ? (
                  <button type="button" onClick={() => toggleStatus(entry)} className="mt-0.5 text-primary">
                    {entry.status === "completed" ? <CheckCircle2 className="size-5" /> : <Circle className="size-5 text-muted-foreground" />}
                  </button>
                ) : (
                  <span className="mt-0.5 text-primary">
                    {entry.status === "completed" ? <CheckCircle2 className="size-5" /> : <Circle className="size-5 text-muted-foreground" />}
                  </span>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{entry.label}</Badge>
                    {entry.scheduled_date && (
                      <Badge variant="secondary">{new Date(entry.scheduled_date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Badge>
                    )}
                    {entry.status === "completed" && <Badge>Covered</Badge>}
                  </div>
                  <p className="mt-1 font-medium">{entry.topic}</p>
                  {entry.objectives && <p className="mt-1 text-sm text-muted-foreground">Objectives: {entry.objectives}</p>}
                  {entry.resources && <p className="text-sm text-muted-foreground">Resources: {entry.resources}</p>}
                  {entry.notes && <p className="text-sm text-muted-foreground">Notes: {entry.notes}</p>}
                </div>
              </div>
              {canRecord && (
              <div className="flex items-center gap-2">
                <EditEntryDialog schoolId={plan.school_id} planId={plan.id} entry={entry} onUpdated={handleEntryUpdated} />
                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteEntry(entry.id)}><Trash2 /></Button>
              </div>
              )}
            </CardContent>
          </Card>
        ))}
        {plan.entries.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No entries yet — add one above, or fill the whole term at once.
          </p>
        )}
      </div>
    </div>
  );
}
