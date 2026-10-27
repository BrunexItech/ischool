"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { ModuleBanner } from "@/components/ModuleBanner";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Award as AwardIcon, Plus, RotateCw, Search, Trash2, Trophy, Users } from "lucide-react";
import { api, ApiError, Activity, ActivityDetail, MyClass, SchoolClass, Student } from "@/lib/api";
import { ClassStudentPicker } from "@/components/ClassStudentPicker";
import { useAuth } from "@/lib/auth";
import { localDateStr } from "@/lib/dates";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DepartmentPulse } from "@/components/DepartmentPulse";

const CATEGORIES = ["Sports", "Academic", "Arts and music", "Clubs", "Community service", "Other"];
const SCOPE_TEXT = { school: "Whole school", class: "One class", invited: "Invited learners" } as const;

interface Loaded {
  activities: Activity[];
  students: Student[];
  classes: SchoolClass[];
  myClasses: MyClass[];
}

async function fetchAll(token: string, schoolId: number, isTeacher: boolean): Promise<{ data: Loaded; failed: boolean }> {
  let failed = false;
  const [activities, students, classes, myClasses] = await Promise.all([
    api.listActivities(token, schoolId).catch(() => {
      failed = true;
      return [] as Activity[];
    }),
    api.listStudents(token, schoolId).catch(() => [] as Student[]),
    api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
    isTeacher ? api.listMyClasses(token, schoolId).catch(() => [] as MyClass[]) : Promise.resolve([] as MyClass[]),
  ]);
  return { data: { activities, students, classes, myClasses }, failed };
}

function NewActivityDialog({ data, isAdmin, isTeacher, onClose, onCreated }: { data: Loaded; isAdmin: boolean; isTeacher: boolean; onClose: () => void; onCreated: (a: Activity) => void }) {
  const { token, user } = useAuth();
  const allowedScopes = (["school", "class", "invited"] as const).filter((s) => !(s === "school" && isTeacher));
  const [form, setForm] = useState({ name: "", category: "", date: localDateStr(), description: "", scope: allowedScopes[0] as "school" | "class" | "invited", classId: "" });
  const [saving, setSaving] = useState(false);
  const mine = new Set(data.myClasses.map((c) => c.class_id));
  const classOptions = isTeacher ? data.classes.filter((c) => mine.has(c.id)) : data.classes;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    if (form.scope === "class" && !form.classId) {
      toast.error("Choose the class this activity is for");
      return;
    }
    setSaving(true);
    try {
      const created = await api.createActivity(token, user.school_id, {
        name: form.name.trim(),
        category: form.category || undefined,
        date: form.date,
        description: form.description.trim() || undefined,
        scope: form.scope,
        class_id: form.scope === "class" ? Number(form.classId) : undefined,
      });
      onCreated(created);
      toast.success(`${created.name} added`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create activity");
      setSaving(false);
    }
  }
  void isAdmin;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>New activity</DialogTitle></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input required placeholder="e.g. Inter-house Sports Day" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => v && setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input required type="date" value={form.date} onChange={(e) => e.target.value && setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Who is it for?</Label>
            <div role="radiogroup" className={`grid gap-1 rounded-lg bg-muted p-1 ${allowedScopes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {allowedScopes.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={form.scope === s} onClick={() => setForm((f) => ({ ...f, scope: s }))} className={`min-h-10 rounded-md px-1 text-sm font-medium transition-colors ${form.scope === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {SCOPE_TEXT[s]}
                </button>
              ))}
            </div>
            {form.scope === "class" && (
              <Select value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>{classOptions.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              {form.scope === "school" ? "Learners from any class can take part." : form.scope === "class" ? "Only learners of that class can be added." : "You choose which learners to invite."}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Description (optional)</Label>
            <Input placeholder="Short description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Spinner size={16} className="text-current" />} Add activity</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantsDialog({ activity, data, canManage, isTeacher, onClose, onChanged }: { activity: Activity; data: Loaded; canManage: boolean; isTeacher: boolean; onClose: () => void; onChanged: () => void }) {
  const { token, user } = useAuth();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    api.getActivity(token, user.school_id, activity.id).then((d) => !cancelled && setDetail(d)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, activity.id, reload]);

  const mine = new Set(data.myClasses.map((c) => c.class_id));
  let classes = isTeacher ? data.classes.filter((c) => mine.has(c.id)) : data.classes;
  if (activity.scope === "class") classes = classes.filter((c) => c.id === activity.class_id);
  const taken = new Set(detail?.participants.map((p) => p.student_id));
  const pickable = data.students.filter((s) => !taken.has(s.id));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !studentId) return;
    setSubmitting(true);
    try {
      await api.addActivityParticipant(token, user.school_id, activity.id, { student_id: Number(studentId), role: role.trim() || undefined });
      setStudentId("");
      setRole("");
      setReload((k) => k + 1);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add participant");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(sid: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.removeActivityParticipant(token, user.school_id, activity.id, sid);
      setReload((k) => k + 1);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{activity.name}: participants</DialogTitle></DialogHeader>
        {canManage && (
          <form onSubmit={add} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <ClassStudentPicker classes={classes} students={pickable} value={studentId} onChange={setStudentId} />
            <Input placeholder="Role or event, e.g. 100m, team captain (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
            <Button size="sm" type="submit" className="w-fit" disabled={submitting || !studentId}>{submitting ? "Adding..." : "Add learner"}</Button>
          </form>
        )}
        <ul className="flex flex-col gap-1.5">
          {detail?.participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0 break-words">{p.student_name}{p.role ? <span className="text-muted-foreground"> · {p.role}</span> : null}</span>
              {canManage && <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Remove ${p.student_name}`} onClick={() => remove(p.student_id)}><Trash2 /></Button>}
            </li>
          ))}
          {detail && detail.participants.length === 0 && <EmptyNote>No participants recorded yet.</EmptyNote>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function AwardResultsDialog({ activity, onClose, onDone }: { activity: Activity; onClose: () => void; onDone: () => void }) {
  const { token, user } = useAuth();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    api.getActivity(token, user.school_id, activity.id).then((d) => {
      if (cancelled) return;
      setDetail(d);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, activity.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    const awards = Object.entries(titles).filter(([, t]) => t.trim()).map(([sid, t]) => ({ student_id: Number(sid), title: t.trim() }));
    if (awards.length === 0) {
      toast.error("Write an award for at least one learner");
      return;
    }
    setSaving(true);
    try {
      const made = await api.awardFromActivity(token, user.school_id, activity.id, awards, notify);
      toast.success(`${made.length} award${made.length === 1 ? "" : "s"} given`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not give the awards");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Give awards from {activity.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Type an award next to each learner who earned one, such as &ldquo;1st place, 100m&rdquo;. Leave the rest blank.</p>
        <form onSubmit={save} className="flex flex-col gap-3">
          {!detail ? (
            <PageLoader />
          ) : detail.participants.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Add participants first.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.participants.map((p) => (
                <li key={p.id} className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3">
                  <span className="text-sm font-medium break-words">{p.student_name}</span>
                  <Input aria-label={`Award for ${p.student_name}`} placeholder="Award (optional)" value={titles[p.student_id] ?? ""} onChange={(e) => setTitles((t) => ({ ...t, [p.student_id]: e.target.value }))} className="h-10" />
                </li>
              ))}
            </ul>
          )}
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} /> Tell the guardians</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !detail || detail.participants.length === 0}>{saving && <Spinner size={16} className="text-current" />} Give awards</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ActivitiesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isAdmin = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";
  const isTeacher = user?.role === "teacher";
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [people, setPeople] = useState<Activity | null>(null);
  const [awarding, setAwarding] = useState<Activity | null>(null);
  const [removing, setRemoving] = useState<Activity | null>(null);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal", "secretary"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    fetchAll(token, schoolId, isTeacher).then(({ data: d, failed: f }) => {
      if (cancelled) return;
      setData(d);
      setFailed(f);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, reloadKey]);

  if (loading || !data) return failed ? null : <PageLoader />;

  const reload = () => setReloadKey((k) => k + 1);
  const manages = (a: Activity) => isAdmin || a.created_by === user?.id;
  const q = search.trim().toLowerCase();
  const visible = data.activities.filter((a) => !q || `${a.name} ${a.category ?? ""} ${a.class_name ?? ""} ${a.created_by_name ?? ""}`.toLowerCase().includes(q));
  const today = localDateStr();

  async function confirmRemove() {
    if (!token || !schoolId || !removing) return;
    try {
      await api.deleteActivity(token, schoolId, removing.id);
      setData((d) => (d ? { ...d, activities: d.activities.filter((x) => x.id !== removing.id) } : d));
      setRemoving(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete activity");
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <ModuleBanner title="Activities &amp; Competitions" description="Events and who took part: sports, academics, arts and clubs."><Button className="h-10 w-fit sm:h-9" onClick={() => setNewOpen(true)}><Plus /> New activity</Button></ModuleBanner>

      <DepartmentPulse dept="activities" />

      {data.activities.length > 0 && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities..." aria-label="Search activities" className="h-10 pl-8" />
        </div>
      )}

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the activities.</p>
          <Button size="sm" variant="outline" onClick={reload}><RotateCw /> Try again</Button>
        </div>
      ) : data.activities.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <Trophy className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No activities yet</p>
          <Button size="sm" className="mt-2" onClick={() => setNewOpen(true)}><Plus /> New activity</Button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyNote>No activities match.</EmptyNote>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card divide-y">
          {visible.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:gap-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Trophy className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{a.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{new Date(a.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  {a.date > today && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">Upcoming</span>}
                  {a.category && <span>{a.category}</span>}
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{a.scope === "class" ? a.class_name ?? "One class" : SCOPE_TEXT[a.scope]}</span>
                  {a.created_by_name && <span>run by {a.created_by_name}</span>}
                </div>
                {a.description && <p className="mt-1.5 text-sm break-words text-muted-foreground">{a.description}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="h-10 sm:h-8" onClick={() => setPeople(a)}><Users /> Participants ({a.participant_count})</Button>
                {manages(a) && a.participant_count > 0 && <Button size="sm" variant="outline" className="h-10 sm:h-8" onClick={() => setAwarding(a)}><AwardIcon /> Give awards</Button>}
                {manages(a) && <Button variant="ghost" size="icon" className="size-10 text-destructive sm:size-8" aria-label={`Delete ${a.name}`} onClick={() => setRemoving(a)}><Trash2 /></Button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {newOpen && <NewActivityDialog data={data} isAdmin={isAdmin} isTeacher={isTeacher} onClose={() => setNewOpen(false)} onCreated={(a) => setData((d) => (d ? { ...d, activities: [a, ...d.activities] } : d))} />}
      {people && <ParticipantsDialog activity={people} data={data} canManage={manages(people)} isTeacher={isTeacher} onClose={() => setPeople(null)} onChanged={reload} />}
      {awarding && <AwardResultsDialog activity={awarding} onClose={() => setAwarding(null)} onDone={reload} />}

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete this activity?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">&ldquo;{removing?.name}&rdquo; and its participant list will be removed. Awards already given from it stay.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemove}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
