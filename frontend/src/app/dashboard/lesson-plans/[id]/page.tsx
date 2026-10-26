"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, GripVertical, Pencil, Plus, Printer, Trash2, Wand2 } from "lucide-react";
import { api, AcademicTerm, ApiError, LessonPlanDetail, LessonPlanEntry, SchoolClass, Subject } from "@/lib/api";
import { localDateStr } from "@/lib/dates";
import { useAuth } from "@/lib/auth";
import { BackButton } from "@/components/BackButton";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Edit topic" className="size-10 sm:size-8"><Pencil /></Button>} />
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
      <DialogTrigger render={<Button variant="outline" className="h-10 sm:h-9">Fill the whole term</Button>} />
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

function DuplicateDialog({ plan, classes, subjects, terms, onClose }: { plan: LessonPlanDetail; classes: SchoolClass[]; subjects: Subject[]; terms: AcademicTerm[]; onClose: () => void }) {
  const router = useRouter();
  const { token, user } = useAuth();
  const [form, setForm] = useState({ classId: String(plan.class_id), subjectId: String(plan.subject_id), term: plan.term });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      const copy = await api.duplicateLessonPlan(token, user.school_id, plan.id, { class_id: Number(form.classId), subject_id: Number(form.subjectId), term: form.term });
      toast.success("Plan copied. Dates and covered marks start fresh.");
      router.push(`/dashboard/lesson-plans/${copy.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not copy the plan");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Copy this plan</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Copies all {plan.entry_count} topics, objectives and resources into another class, subject or term. Nothing is marked as covered in the copy.</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Subject</Label>
            <Select value={form.subjectId} onValueChange={(v) => v && setForm((f) => ({ ...f, subjectId: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Term</Label>
            {terms.length > 0 ? (
              <Select value={form.term} onValueChange={(v) => v && setForm((f) => ({ ...f, term: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input required value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Spinner size={16} className="text-current" />} Copy plan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function shortDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

interface PlanData {
  plan: LessonPlanDetail | null;
  classes: SchoolClass[];
  subjects: Subject[];
  terms: AcademicTerm[];
}

export default function LessonPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const canRecord = user?.role === "super_admin" || user?.role === "teacher" || user?.role === "staff";
  const [data, setData] = useState<PlanData | null>(null);
  const [entries, setEntries] = useState<LessonPlanEntry[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ label: "", scheduled_date: "", topic: "" });
  const [adding, setAdding] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleting, setDeleting] = useState<LessonPlanEntry | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [dragId, setDragId] = useState<number | null>(null);
  const today = localDateStr();

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    Promise.all([
      api.getLessonPlan(token, user.school_id, Number(id)).catch(() => null),
      api.listClasses(token, user.school_id).catch(() => [] as SchoolClass[]),
      api.listSubjects(token, user.school_id).catch(() => [] as Subject[]),
      api.listAcademicTerms(token, user.school_id).catch(() => [] as AcademicTerm[]),
    ]).then(([plan, classes, subjects, terms]) => {
      if (cancelled) return;
      setData({ plan, classes, subjects, terms });
      setEntries(plan?.entries ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, id]);

  const plan = data?.plan ?? null;
  const className = data?.classes.find((c) => c.id === plan?.class_id)?.name ?? "Class";
  const subjectName = data?.subjects.find((s) => s.id === plan?.subject_id)?.name ?? "Subject";

  const nextId = useMemo(() => entries.find((e) => e.status === "planned")?.id ?? null, [entries]);
  const covered = entries.filter((e) => e.status === "completed").length;
  const behind = entries.filter((e) => e.status === "planned" && e.scheduled_date && e.scheduled_date < today).length;

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !plan || !addForm.label || !addForm.topic) return;
    setAdding(true);
    try {
      const entry = await api.addLessonPlanEntry(token, user.school_id, plan.id, {
        order: (entries[entries.length - 1]?.order ?? 0) + 1,
        label: addForm.label,
        scheduled_date: addForm.scheduled_date || undefined,
        topic: addForm.topic,
      });
      setEntries((es) => [...es, entry]);
      setAddForm({ label: "", scheduled_date: "", topic: "" });
      toast.success("Topic added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add entry");
    } finally {
      setAdding(false);
    }
  }

  async function toggleStatus(entry: LessonPlanEntry) {
    if (!token || !user?.school_id || !plan) return;
    const next = entry.status === "completed" ? "planned" : "completed";
    try {
      const updated = await api.updateLessonPlanEntry(token, user.school_id, plan.id, entry.id, { status: next });
      setEntries((es) => es.map((e) => (e.id === entry.id ? updated : e)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the topic");
    }
  }

  async function confirmDelete() {
    if (!token || !user?.school_id || !plan || !deleting) return;
    try {
      await api.deleteLessonPlanEntry(token, user.school_id, plan.id, deleting.id);
      setEntries((es) => es.filter((e) => e.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete the topic");
    }
  }

  async function move(fromId: number, toId: number) {
    if (!token || !user?.school_id || !plan || fromId === toId) return;
    const before = entries;
    const from = before.findIndex((e) => e.id === fromId);
    const to = before.findIndex((e) => e.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...before];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setEntries(next);
    try {
      const saved = await api.reorderLessonPlanEntries(token, user.school_id, plan.id, next.map((e) => e.id));
      setEntries(saved.entries);
    } catch (err) {
      setEntries(before);
      toast.error(err instanceof ApiError ? err.message : "Could not reorder");
    }
  }

  function toggleOpen(entryId: number) {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(entryId)) n.delete(entryId);
      else n.add(entryId);
      return n;
    });
  }

  if (loading || !data) return <PageLoader />;
  if (!plan) {
    return (
      <div className="flex flex-col gap-4">
        <BackButton fallback="/dashboard/lesson-plans" label="All lesson plans" />
        <p className="text-sm text-muted-foreground">Lesson plan not found.</p>
      </div>
    );
  }

  const nextAfterMark = entries.find((e) => e.status === "planned");

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-5 sm:gap-6 print:hidden">
        <BackButton fallback="/dashboard/lesson-plans" label="All lesson plans" />

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl">{subjectName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {className} · {plan.term}
              {plan.created_by_name ? ` · set up by ${plan.created_by_name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 sm:h-9" onClick={() => window.print()}><Printer /> Print scheme</Button>
            {canRecord && (
              <>
                <Button variant="outline" className="h-10 sm:h-9" onClick={() => setCopyOpen(true)}><Copy /> Copy plan</Button>
                <BulkFillDialog schoolId={plan.school_id} planId={plan.id} nextOrder={(entries[entries.length - 1]?.order ?? 0) + 1} onReplaced={(p) => setEntries(p.entries)} />
              </>
            )}
          </div>
        </header>

        <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Term progress">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm">
              <span className="font-heading text-xl font-semibold tabular-nums">{covered}</span>
              <span className="text-muted-foreground"> of {entries.length} topics covered</span>
            </p>
            {behind > 0 && <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{behind} behind schedule</p>}
          </div>
          {entries.length > 0 && (
            <div className="mt-3 flex gap-0.5" role="img" aria-label={`${covered} of ${entries.length} topics covered`}>
              {entries.map((e) => (
                <span
                  key={e.id}
                  title={`${e.label}: ${e.topic}`}
                  className={`h-2 min-w-0.5 flex-1 rounded-sm ${
                    e.status === "completed" ? "bg-primary" : e.id === nextId ? "bg-primary/35 ring-1 ring-primary" : e.scheduled_date && e.scheduled_date < today ? "bg-amber-400" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
          {nextAfterMark && <p className="mt-3 text-sm text-muted-foreground">Next: <span className="font-medium text-foreground">{nextAfterMark.topic}</span></p>}
        </section>

        {canRecord && (
          <div>
            {!addOpen ? (
              <Button variant="outline" className="h-10 sm:h-9" onClick={() => setAddOpen(true)}><Plus /> Add a topic</Button>
            ) : (
              <form onSubmit={handleAddEntry} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[9rem_10rem_minmax(0,1fr)_auto] sm:items-end">
                <div className="grid gap-1.5">
                  <Label>Label</Label>
                  <Input required autoFocus placeholder="e.g. Week 1" value={addForm.label} onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Date (optional)</Label>
                  <Input type="date" value={addForm.scheduled_date} onChange={(e) => setAddForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Topic</Label>
                  <Input required value={addForm.topic} onChange={(e) => setAddForm((f) => ({ ...f, topic: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={adding}><Plus /> {adding ? "Adding..." : "Add"}</Button>
                  <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Done</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card py-12 text-center text-sm text-muted-foreground">No topics yet. Add one above, or fill the whole term at once.</p>
        ) : (
          <ol className="relative flex flex-col" aria-label="Topics in order">
            <span className="absolute top-3 bottom-3 left-[0.95rem] w-px bg-border" aria-hidden />
            {entries.map((entry, index) => {
              const isDone = entry.status === "completed";
              const isNext = entry.id === nextId;
              const isBehind = !isDone && !!entry.scheduled_date && entry.scheduled_date < today;
              const hasDetail = !!(entry.objectives || entry.resources || entry.notes);
              const expanded = isNext || (!isDone && hasDetail) || open.has(entry.id);
              return (
                <li
                  key={entry.id}
                  draggable={canRecord}
                  onDragStart={() => setDragId(entry.id)}
                  onDragOver={(e) => canRecord && e.preventDefault()}
                  onDrop={() => {
                    if (dragId !== null) move(dragId, entry.id);
                    setDragId(null);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={`relative flex gap-3 py-1.5 sm:gap-4 ${dragId === entry.id ? "opacity-50" : ""}`}
                >
                  <span className="relative z-10 flex w-8 shrink-0 justify-center pt-3.5">
                    <span
                      className={`flex size-4 items-center justify-center rounded-full border-2 bg-background ${
                        isDone ? "border-primary bg-primary text-primary-foreground" : isNext ? "border-primary ring-4 ring-primary/15" : isBehind ? "border-amber-500" : "border-border"
                      }`}
                    >
                      {isDone && <Check className="size-2.5" strokeWidth={4} />}
                    </span>
                  </span>

                  <div className={`min-w-0 flex-1 rounded-xl border bg-card ${isNext ? "border-primary/50 shadow-sm" : ""} ${isDone && !expanded ? "bg-muted/30" : ""}`}>
                    <div className="flex items-start gap-2 p-3 sm:p-3.5">
                      {canRecord && <GripVertical className="mt-1 hidden size-4 shrink-0 cursor-grab text-muted-foreground/60 sm:block" aria-hidden />}
                      <button type="button" onClick={() => toggleOpen(entry.id)} className="min-w-0 flex-1 text-left outline-none" aria-expanded={expanded}>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-semibold tracking-wide uppercase">{entry.label}</span>
                          {entry.scheduled_date && <span>{shortDate(entry.scheduled_date)}</span>}
                          {isNext && <span className="font-semibold text-primary">Up next</span>}
                          {isBehind && <span className="font-medium text-amber-700 dark:text-amber-400">Behind: was due {shortDate(entry.scheduled_date!)}</span>}
                        </span>
                        <span className={`mt-0.5 block font-medium break-words ${isDone ? "text-muted-foreground" : ""}`}>{entry.topic}</span>
                      </button>
                      {isDone && !canRecord && <Check className="mt-1 size-4 shrink-0 text-primary" aria-label="Covered" />}
                      {canRecord && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button type="button" variant="ghost" size="icon" className="size-10 sm:size-8" aria-label={expanded ? "Hide options" : "Show options"} aria-expanded={expanded} onClick={() => toggleOpen(entry.id)}>
                            <ChevronDown className={expanded ? "rotate-180" : ""} />
                          </Button>
                          <Button type="button" variant={isDone ? "outline" : "ghost"} size="sm" className="h-10 sm:h-8" onClick={() => toggleStatus(entry)} aria-pressed={isDone}>
                            <Check /> {isDone ? "Covered" : "Mark covered"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {expanded && (hasDetail || canRecord) && (
                      <div className="flex flex-col gap-3 border-t px-3 py-3 sm:px-3.5">
                        {hasDetail && (
                          <dl className="grid gap-1.5 text-sm">
                            {entry.objectives && <div><dt className="inline font-medium">Objectives: </dt><dd className="inline break-words text-muted-foreground">{entry.objectives}</dd></div>}
                            {entry.resources && <div><dt className="inline font-medium">Resources: </dt><dd className="inline break-words text-muted-foreground">{entry.resources}</dd></div>}
                            {entry.notes && <div><dt className="inline font-medium">Notes: </dt><dd className="inline break-words text-muted-foreground">{entry.notes}</dd></div>}
                          </dl>
                        )}
                        {canRecord && (
                          <div className="flex flex-wrap items-center gap-1">
                            <EditEntryDialog schoolId={plan.school_id} planId={plan.id} entry={entry} onUpdated={(u) => setEntries((es) => es.map((e) => (e.id === u.id ? u : e)))} />
                            <Button type="button" variant="ghost" size="icon" className="size-10 sm:size-8" aria-label="Move up" disabled={index === 0} onClick={() => move(entry.id, entries[index - 1].id)}><ArrowUp /></Button>
                            <Button type="button" variant="ghost" size="icon" className="size-10 sm:size-8" aria-label="Move down" disabled={index === entries.length - 1} onClick={() => move(entry.id, entries[index + 1].id)}><ArrowDown /></Button>
                            <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive sm:size-8" aria-label="Delete topic" onClick={() => setDeleting(entry)}><Trash2 /></Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Printed scheme of work */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Milai-School-Logo.svg" alt="Milai School" className="h-16 w-auto" />
          <div className="text-right">
            <h1 className="text-xl font-bold">Scheme of Work</h1>
            <p className="text-sm">{subjectName} · {className} · {plan.term}</p>
            {plan.created_by_name && <p className="text-sm">Teacher: {plan.created_by_name}</p>}
          </div>
        </div>
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-100 text-left">
              {["Week / lesson", "Date", "Topic", "Objectives", "Resources", "Remarks"].map((h) => <th key={h} className="border border-neutral-400 px-2 py-1.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="border border-neutral-400 px-2 py-1.5">{e.label}</td>
                <td className="border border-neutral-400 px-2 py-1.5">{e.scheduled_date ? shortDate(e.scheduled_date) : ""}</td>
                <td className="border border-neutral-400 px-2 py-1.5 font-medium">{e.topic}</td>
                <td className="border border-neutral-400 px-2 py-1.5">{e.objectives}</td>
                <td className="border border-neutral-400 px-2 py-1.5">{e.resources}</td>
                <td className="border border-neutral-400 px-2 py-1.5">{e.status === "completed" ? "Covered" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-8 flex justify-between text-xs"><span>Teacher: ____________________</span><span>Head of institution: ____________________</span></div>
      </div>

      {copyOpen && <DuplicateDialog plan={plan} classes={data.classes} subjects={data.subjects} terms={data.terms} onClose={() => setCopyOpen(false)} />}

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete this topic?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">&ldquo;{deleting?.topic}&rdquo; will be removed from the plan. Lessons already recorded keep their topic name.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
