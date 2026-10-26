"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Award as AwardIcon, FileText, Plus, RotateCw, Search, Trash2 } from "lucide-react";
import { api, AcademicTerm, ApiError, Award, AwardScope, MyClass, SchoolClass, Staff, Student } from "@/lib/api";
import { ClassStudentPicker } from "@/components/ClassStudentPicker";
import { useAuth } from "@/lib/auth";
import { localDateStr } from "@/lib/dates";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AWARD_CATEGORIES = ["Academic excellence", "Most improved", "Sports", "Leadership", "Good conduct", "Attendance", "Arts and creativity", "Service", "Other"];

const SCOPE_LABEL: Record<AwardScope, string> = { student: "Learner", class: "Whole class", school: "Whole school", staff: "Staff" };
const SCOPE_PILL: Record<AwardScope, string> = {
  student: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  class: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  school: "bg-primary/10 text-primary",
  staff: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};
const ALL = "__all__";
const UNDO_MS = 24 * 60 * 60 * 1000;

interface Loaded {
  awards: Award[];
  students: Student[];
  classes: SchoolClass[];
  myClasses: MyClass[];
  staff: Staff[];
  terms: AcademicTerm[];
}

async function fetchAll(token: string, schoolId: number, isTeacher: boolean, isAdmin: boolean): Promise<{ data: Loaded; failed: boolean }> {
  let failed = false;
  const [awards, students, classes, myClasses, staff, terms] = await Promise.all([
    api.listAwards(token, schoolId).catch(() => {
      failed = true;
      return [] as Award[];
    }),
    api.listStudents(token, schoolId).catch(() => [] as Student[]),
    api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
    isTeacher ? api.listMyClasses(token, schoolId).catch(() => [] as MyClass[]) : Promise.resolve([] as MyClass[]),
    isAdmin ? api.listStaff(token, schoolId).catch(() => [] as Staff[]) : Promise.resolve([] as Staff[]),
    api.listAcademicTerms(token, schoolId).catch(() => [] as AcademicTerm[]),
  ]);
  return { data: { awards, students, classes, myClasses, staff, terms }, failed };
}

function GiveAwardDialog({ data, isAdmin, isTeacher, onClose, onCreated }: { data: Loaded; isAdmin: boolean; isTeacher: boolean; onClose: () => void; onCreated: (a: Award) => void }) {
  const { token, user } = useAuth();
  const homeroom = data.myClasses.filter((c) => c.is_homeroom_teacher);
  const scopes = (["student", "class", "school", "staff"] as AwardScope[]).filter((s) => (s === "student" ? true : s === "class" ? isAdmin || homeroom.length > 0 : isAdmin));
  const [scope, setScope] = useState<AwardScope>("student");
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(localDateStr());
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  // Teachers award only learners in classes they teach, and the subject follows the learner's class.
  const teacherClassIds = new Set(data.myClasses.map((c) => c.class_id));
  const classOptions = isTeacher ? data.classes.filter((c) => teacherClassIds.has(c.id)) : data.classes;
  const student = data.students.find((s) => String(s.id) === studentId);
  const subjectOptions = isTeacher ? (data.myClasses.find((c) => c.class_id === student?.class_id)?.subjects ?? []).map((s) => ({ id: s.subject_id, name: s.subject_name })) : [];
  const classChoices = isAdmin ? data.classes : data.classes.filter((c) => homeroom.some((h) => h.class_id === c.id));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    const finalCategory = category === "Other" ? customCategory.trim() : category;
    const recipient =
      scope === "student" ? { student_id: Number(studentId) } : scope === "class" ? { class_id: Number(classId) } : scope === "staff" ? { staff_user_id: Number(staffId) } : {};
    if ((scope === "student" && !studentId) || (scope === "class" && !classId) || (scope === "staff" && !staffId)) {
      toast.error("Choose who the award is for");
      return;
    }
    setSaving(true);
    try {
      const created = await api.createAward(token, user.school_id, {
        scope,
        ...recipient,
        subject_id: scope === "student" && subjectId ? Number(subjectId) : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        category: finalCategory || undefined,
        date_awarded: date,
        notify_guardian: notify,
      });
      onCreated(created);
      toast.success(`Award given to ${created.recipient_name}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create award");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Give an award</DialogTitle></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Who is it for" className={`grid gap-1 rounded-lg bg-muted p-1 ${scopes.length === 4 ? "grid-cols-2 sm:grid-cols-4" : scopes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {scopes.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => setScope(s)} className={`h-10 rounded-md text-sm font-medium transition-colors ${scope === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>

          {scope === "student" && (
            <>
              <ClassStudentPicker classes={classOptions} students={data.students} value={studentId} onChange={(v) => { setStudentId(v); setSubjectId(""); }} />
              {subjectOptions.length > 0 && (
                <div className="grid gap-1.5">
                  <Label>Subject (optional)</Label>
                  <Select value={subjectId} onValueChange={(v) => setSubjectId(v === "none" ? "" : (v ?? ""))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Not tied to a subject" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not tied to a subject</SelectItem>
                      {subjectOptions.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          {scope === "class" && (
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>{classChoices.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {!isAdmin && <p className="text-xs text-muted-foreground">As class teacher you can give an award to the whole of your own class.</p>}
            </div>
          )}
          {scope === "school" && <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">This award is for the whole school and will be visible to everyone, including every guardian.</p>}
          {scope === "staff" && (
            <div className="grid gap-1.5">
              <Label>Staff member</Label>
              <Select value={staffId} onValueChange={(v) => v && setStaffId(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a staff member" /></SelectTrigger>
                <SelectContent>{data.staff.map((s) => <SelectItem key={s.user_id} value={String(s.user_id)}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Award title</Label>
            <Input required placeholder="e.g. Most improved in Mathematics" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>{AWARD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date awarded</Label>
              <Input required type="date" value={date} max={localDateStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
          </div>
          {category === "Other" && <Input placeholder="Name of the category" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />}
          <div className="grid gap-1.5">
            <Label>Citation (optional)</Label>
            <Textarea rows={2} placeholder="A line on why this award was earned. It appears on the certificate." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {(scope === "student" || scope === "class") && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} /> Tell the guardian{scope === "class" ? "s" : ""}
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>{saving && <Spinner size={16} className="text-current" />} Give award</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AwardsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isAdmin = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";
  const isTeacher = user?.role === "teacher";

  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState(ALL);
  const [scope, setScope] = useState<string>(ALL);
  const [category, setCategory] = useState(ALL);
  const [giveOpen, setGiveOpen] = useState(false);
  const [removing, setRemoving] = useState<Award | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    fetchAll(token, schoolId, isTeacher, isAdmin).then(({ data: d, failed: f }) => {
      if (cancelled) return;
      setData(d);
      setFailed(f);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, isAdmin, reloadKey]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data?.awards ?? []).filter((a) => {
      if (term !== ALL && a.term !== term) return false;
      if (scope !== ALL && a.scope !== scope) return false;
      if (category !== ALL && a.category !== category) return false;
      return !q || `${a.recipient_name} ${a.title} ${a.class_name ?? ""} ${a.category ?? ""}`.toLowerCase().includes(q);
    });
    const byMonth = new Map<string, Award[]>();
    for (const a of list) {
      const key = a.date_awarded.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), a]);
    }
    return Array.from(byMonth.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [data, search, term, scope, category]);

  if (loading || !data) return failed ? null : <PageLoader />;

  const canGive = user?.role !== "staff";
  const canUndo = (a: Award) => isAdmin || (a.awarded_by === user?.id && now - new Date(a.created_at).getTime() <= UNDO_MS);
  const categories = Array.from(new Set(data.awards.map((a) => a.category).filter(Boolean))) as string[];

  async function confirmRemove() {
    if (!token || !schoolId || !removing) return;
    try {
      await api.deleteAward(token, schoolId, removing.id);
      setData((d) => (d ? { ...d, awards: d.awards.filter((x) => x.id !== removing.id) } : d));
      setRemoving(null);
      toast.success("Award removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove award");
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Awards &amp; Recognition</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.awards.length} award{data.awards.length === 1 ? "" : "s"}
            {isTeacher ? " for your learners and classes" : ""}
          </p>
        </div>
        {canGive ? (
          <Button className="h-10 w-fit sm:h-9" onClick={() => setGiveOpen(true)}><Plus /> Give award</Button>
        ) : (
          <p className="max-w-xs text-sm text-muted-foreground">Staff give awards to learners from an activity they run, under Activities.</p>
        )}
      </header>

      {data.awards.length > 0 && (
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_13rem]" aria-label="Filters">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search awards..." aria-label="Search awards" className="h-10 pl-8" />
          </div>
          <Select value={term} onValueChange={(v) => v && setTerm(v)}>
            <SelectTrigger className="h-10 w-full" aria-label="Term"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All terms</SelectItem>
              {data.terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={scope} onValueChange={(v) => v && setScope(v)}>
            <SelectTrigger className="h-10 w-full" aria-label="Given to"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everyone</SelectItem>
              {(Object.keys(SCOPE_LABEL) as AwardScope[]).filter((s) => s !== "staff" || isAdmin).map((s) => <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => v && setCategory(v)}>
            <SelectTrigger className="h-10 w-full" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </section>
      )}

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the awards.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
        </div>
      ) : data.awards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <AwardIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No awards yet</p>
          <p className="text-xs text-muted-foreground">Recognise a learner, a class or the whole school, and it appears here.</p>
          {canGive && <Button size="sm" className="mt-2" onClick={() => setGiveOpen(true)}><Plus /> Give award</Button>}
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No awards match.</p>
      ) : (
        groups.map(([month, awards]) => (
          <section key={month} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {new Date(month + "-15T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </h2>
            <ul className="overflow-hidden rounded-xl border bg-card divide-y">
              {awards.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><AwardIcon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.recipient_name}
                      {a.scope === "student" && a.class_name ? ` · ${a.class_name}` : ""}
                      {a.subject_name ? ` · ${a.subject_name}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${SCOPE_PILL[a.scope]}`}>{SCOPE_LABEL[a.scope]}</span>
                      {a.category && <span>{a.category}</span>}
                      {a.term && <span>{a.term}</span>}
                      <span>{new Date(a.date_awarded + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      {a.awarded_by_name && <span>by {a.awarded_by_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-10 sm:h-8" nativeButton={false} render={<Link href={`/dashboard/awards/${a.id}/certificate`}><FileText /> Certificate</Link>} />
                    {canUndo(a) && (
                      <Button variant="ghost" size="icon" className="size-10 text-destructive sm:size-8" aria-label={isAdmin ? "Delete award" : "Take back award"} onClick={() => setRemoving(a)}><Trash2 /></Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {giveOpen && canGive && (
        <GiveAwardDialog
          data={data}
          isAdmin={isAdmin}
          isTeacher={isTeacher}
          onClose={() => setGiveOpen(false)}
          onCreated={(a) => setData((d) => (d ? { ...d, awards: [a, ...d.awards] } : d))}
        />
      )}

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{isAdmin ? "Delete this award?" : "Take back this award?"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">&ldquo;{removing?.title}&rdquo; for {removing?.recipient_name} will be removed.{isAdmin ? "" : " You can only take back an award within 24 hours of giving it."}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemove}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
