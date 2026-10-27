"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Library, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError, GradeLevel, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ErrorBox, PageHead, Pill } from "@/components/oversight";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GROUPS = [
  ["pre_primary", "Pre-Primary"],
  ["primary", "Primary"],
  ["junior_school", "Junior School"],
  ["senior_school", "Senior School"],
] as const;

function gradeSummary(subject: Subject, grades: GradeLevel[]) {
  const ids = new Set(subject.grade_level_ids ?? []);
  if (ids.size === 0) return null;
  return grades.filter((g) => ids.has(g.id)).sort((a, b) => a.sort_order - b.sort_order);
}

function SubjectDialog({ subject, grades, onClose, onSaved }: { subject: Subject | null; grades: GradeLevel[]; onClose: () => void; onSaved: (s: Subject) => void }) {
  const { token, user } = useAuth();
  const [name, setName] = useState(subject?.name ?? "");
  const [picked, setPicked] = useState<Set<number>>(new Set(subject?.grade_level_ids ?? []));
  const [saving, setSaving] = useState(false);

  function toggle(ids: number[], on: boolean) {
    setPicked((p) => {
      const next = new Set(p);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      const ids = [...picked];
      const saved = subject ? await api.updateSubject(token, user.school_id, subject.id, { name: name.trim(), grade_level_ids: ids }) : await api.createSubject(token, user.school_id, name.trim(), ids);
      toast.success(subject ? "Subject updated" : `${saved.name} added`);
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save the subject.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{subject ? `Edit ${subject.name}` : "Add a subject"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject-name">Subject name</Label>
            <Input id="subject-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Integrated Science" className="h-11" autoFocus />
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">Taught in these grades</legend>
            <p className="-mt-1 text-xs text-muted-foreground">Only classes in the grades you pick can be given this subject, in teaching assignments and on the timetable. Leave all empty to allow every class.</p>
            {GROUPS.map(([key, label]) => {
              const inGroup = grades.filter((g) => g.level_group === key).sort((a, b) => a.sort_order - b.sort_order);
              if (inGroup.length === 0) return null;
              const all = inGroup.every((g) => picked.has(g.id));
              return (
                <div key={key} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
                    <button type="button" onClick={() => toggle(inGroup.map((g) => g.id), !all)} className="text-xs font-medium text-primary hover:underline">{all ? "Clear" : "Select all"}</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inGroup.map((g) => (
                      <button key={g.id} type="button" aria-pressed={picked.has(g.id)} onClick={() => toggle([g.id], !picked.has(g.id))} className={`h-9 min-w-12 rounded-md border px-3 text-sm font-medium transition-colors ${picked.has(g.id) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{g.code}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-11 sm:h-9" disabled={!name.trim() || saving}>{saving && <Spinner size={16} className="text-current" />} {subject ? "Save changes" : "Add subject"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SubjectsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "group_principal", "super_admin", "secretary"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    Promise.all([api.listSubjects(token, schoolId), api.listEnabledGrades(token, schoolId).catch(() => [] as GradeLevel[]), api.listGradeLevels(token)])
      .then(([ss, enabled, all]) => {
        if (cancelled) return;
        setSubjects(ss);
        setGrades(enabled.length ? enabled : all);
        setFailed(false);
      })
      .catch(() => !cancelled && (setSubjects([]), setFailed(true)));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, reload]);

  const shown = useMemo(() => {
    const list = [...(subjects ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    if (filter === "all") return list;
    const ids = new Set(grades.filter((g) => g.level_group === filter).map((g) => g.id));
    return list.filter((s) => !(s.grade_level_ids?.length) || s.grade_level_ids.some((i) => ids.has(i)));
  }, [subjects, grades, filter]);

  async function remove(s: Subject) {
    if (!token || !schoolId) return;
    try {
      await api.deleteSubject(token, schoolId, s.id);
      setSubjects((all) => (all ?? []).filter((x) => x.id !== s.id));
      toast.success(`${s.name} removed`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't remove that subject.");
    }
  }

  async function seedPrePrimary() {
    if (!token || !schoolId) return;
    setSeeding(true);
    try {
      await api.seedPrePrimaryLearningAreas(token, schoolId);
      toast.success("Official PP1/PP2 learning areas added");
      setReload((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't add the learning areas.");
    } finally {
      setSeeding(false);
    }
  }

  if (loading || !subjects) return <PageLoader />;
  const unplaced = subjects.filter((s) => !(s.grade_level_ids?.length)).length;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Subjects" subtitle="Every subject the school teaches, and the grades each one belongs to. Subjects are added here and nowhere else.">
        <Button variant="outline" className="h-10 sm:h-9" onClick={seedPrePrimary} disabled={seeding}>{seeding && <Spinner size={16} className="text-current" />} Add PP1/PP2 learning areas</Button>
        <Button className="h-10 sm:h-9" onClick={() => setEditing("new")}><Plus /> Add subject</Button>
      </PageHead>

      {failed ? (
        <ErrorBox message="We couldn't load the subjects." onRetry={() => setReload((k) => k + 1)} />
      ) : (
        <>
          {unplaced > 0 && subjects.length > 0 && (
            <p className="rounded-xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
              {unplaced} subject{unplaced === 1 ? " is" : "s are"} not tied to any grade yet, so {unplaced === 1 ? "it can" : "they can"} be given to any class. Edit {unplaced === 1 ? "it" : "them"} to choose the grades.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by level">
            {[["all", "All subjects"], ...GROUPS].map(([k, label]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${filter === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{label}</button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
              <Library className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{subjects.length === 0 ? "No subjects yet. Add the first one and choose the grades it is taught in." : "No subjects for this level."}</p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((s) => {
                const gs = gradeSummary(s, grades);
                return (
                  <li key={s.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 font-medium break-words">{s.name}</h2>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon" className="size-9" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil /></Button>
                        <Button variant="ghost" size="icon" className="size-9" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}><Trash2 /></Button>
                      </div>
                    </div>
                    {gs ? (
                      <div className="flex flex-wrap gap-1.5">{gs.map((g) => <span key={g.id} className="rounded-md border px-2 py-0.5 text-xs font-medium" title={g.display_name}>{g.code}</span>)}</div>
                    ) : (
                      <Pill tone="warn">Open to every class</Pill>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {editing && (
        <SubjectDialog
          key={editing === "new" ? "new" : editing.id}
          subject={editing === "new" ? null : editing}
          grades={grades}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setSubjects((all) => (all?.some((x) => x.id === saved.id) ? all.map((x) => (x.id === saved.id ? saved : x)) : [...(all ?? []), saved]));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
