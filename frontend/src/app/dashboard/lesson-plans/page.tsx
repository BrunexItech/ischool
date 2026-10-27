"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, BookOpen, ChevronDown, ChevronRight, FileText, Plus, MessageSquarePlus, RotateCw, Search } from "lucide-react";
import { api, AcademicTerm, ApiError, Coverage, LessonPlan, MyClass, SchoolClass, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { canGiveFeedback, FeedbackDialog } from "@/components/Feedback";
import { TodayLessons } from "@/components/TodayLessons";
import { ErrorBox, Initials, Meter, Pill } from "@/components/oversight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Loaded {
  plans: LessonPlan[];
  classes: SchoolClass[];
  subjects: Subject[];
  terms: AcademicTerm[];
  myClasses: MyClass[];
}

async function fetchAll(token: string, schoolId: number, isTeacher: boolean): Promise<{ data: Loaded; failed: boolean }> {
  let failed = false;
  const [plans, classes, subjects, terms, myClasses] = await Promise.all([
    api.listLessonPlans(token, schoolId).catch(() => {
      failed = true;
      return [] as LessonPlan[];
    }),
    api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
    api.listSubjects(token, schoolId).catch(() => [] as Subject[]),
    api.listAcademicTerms(token, schoolId).catch(() => [] as AcademicTerm[]),
    isTeacher ? api.listMyClasses(token, schoolId).catch(() => [] as MyClass[]) : Promise.resolve([] as MyClass[]),
  ]);
  return { data: { plans, classes, subjects, terms, myClasses }, failed };
}

function ProgressLine({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Topics covered">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {done} of {total} covered
      </span>
    </div>
  );
}

function NewPlanDialog({
  data,
  isTeacher,
  initial,
  onClose,
}: {
  data: Loaded;
  isTeacher: boolean;
  initial: { classId: string; subjectId: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const currentTerm = data.terms.find((t) => t.is_current)?.name ?? data.terms[0]?.name ?? "";
  const [form, setForm] = useState({ classId: initial.classId, subjectId: initial.subjectId, term: currentTerm });
  const [submitting, setSubmitting] = useState(false);

  const classOptions = isTeacher
    ? data.myClasses.filter((c) => c.subjects.length > 0).map((c) => ({ id: c.class_id, name: c.class_name }))
    : data.classes.map((c) => ({ id: c.id, name: c.name }));
  const subjectOptions = isTeacher
    ? (data.myClasses.find((c) => String(c.class_id) === form.classId)?.subjects ?? []).map((s) => ({ id: s.subject_id, name: s.subject_name }))
    : data.subjects.map((s) => ({ id: s.id, name: s.name }));
  const subjectValue = subjectOptions.some((s) => String(s.id) === form.subjectId) ? form.subjectId : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.classId || !subjectValue || !form.term) return;
    setSubmitting(true);
    try {
      const created = await api.createLessonPlan(token, user.school_id, { class_id: Number(form.classId), subject_id: Number(subjectValue), term: form.term });
      toast.success("Lesson plan created");
      router.push(`/dashboard/lesson-plans/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create lesson plan");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New lesson plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
              <SelectContent>{classOptions.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Subject</Label>
            <Select value={subjectValue} onValueChange={(v) => v && setForm((f) => ({ ...f, subjectId: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder={form.classId ? "Choose a subject" : "Choose a class first"} /></SelectTrigger>
              <SelectContent>{subjectOptions.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Term</Label>
            {data.terms.length > 0 ? (
              <Select value={form.term} onValueChange={(v) => v && setForm((f) => ({ ...f, term: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{data.terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input required placeholder="e.g. Term 1 2026" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting || !form.classId || !subjectValue || !form.term}>
              {submitting && <Spinner size={16} className="text-current" />} Create plan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CovStatus = "ahead" | "ontrack" | "behind" | "noplan";

interface TeacherAgg {
  key: string;
  id: number | null;
  name: string;
  rows: Coverage["rows"];
  covered: number;
  total: number;
  expected: number | null;
  behind: number;
  noPlan: number;
  taught: number;
  partly: number;
  missed: number;
  last: string | null;
  status: CovStatus;
}

const COV_LABEL: Record<CovStatus, { label: string; tone: "good" | "warn" | "bad" | "info" }> = {
  ahead: { label: "Ahead", tone: "info" },
  ontrack: { label: "On track", tone: "good" },
  behind: { label: "Behind", tone: "warn" },
  noplan: { label: "No plan", tone: "bad" },
};

function CoverageView({ terms }: { terms: AcademicTerm[] }) {
  const { user, token } = useAuth();
  const canFeedback = canGiveFeedback(user?.role);
  const [feedbackFor, setFeedbackFor] = useState<{ teacherId: number; teacherName: string; topic: string; link: string } | null>(null);
  const schoolId = user?.school_id ?? null;
  const [term, setTerm] = useState(terms.find((t) => t.is_current)?.name ?? terms[0]?.name ?? "");
  const [data, setData] = useState<{ key: string; coverage: Coverage | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | CovStatus>("all");
  const [sort, setSort] = useState<"behind" | "name" | "progress">("behind");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const key = `${term}/${reloadKey}`;

  useEffect(() => {
    if (!token || !schoolId || !term) return;
    let cancelled = false;
    api
      .getLessonCoverage(token, schoolId, term)
      .then((c) => !cancelled && setData({ key, coverage: c }))
      .catch(() => !cancelled && setData({ key, coverage: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, term, key]);

  const loading = !data || data.key !== key;
  const aggs = useMemo<TeacherAgg[]>(() => {
    const map = new Map<string, TeacherAgg>();
    for (const r of data?.coverage?.rows ?? []) {
      const k = String(r.teacher_user_id ?? "none");
      const a = map.get(k) ?? { key: k, id: r.teacher_user_id, name: r.teacher_name, rows: [], covered: 0, total: 0, expected: null, behind: 0, noPlan: 0, taught: 0, partly: 0, missed: 0, last: null, status: "ontrack" as CovStatus };
      a.rows.push(r);
      if (r.plan_id) {
        a.covered += r.completed_count;
        a.total += r.entry_count;
        if (r.expected_covered != null) {
          a.expected = (a.expected ?? 0) + r.expected_covered;
          if (r.completed_count < r.expected_covered) a.behind += r.expected_covered - r.completed_count;
        }
      } else a.noPlan += 1;
      a.taught += r.taught;
      a.partly += r.partly;
      a.missed += r.not_taught;
      if (r.last_taught && (!a.last || r.last_taught > a.last)) a.last = r.last_taught;
      map.set(k, a);
    }
    for (const a of map.values()) a.status = a.total === 0 ? "noplan" : a.behind > 0 ? "behind" : a.expected != null && a.covered > a.expected + 1 ? "ahead" : a.noPlan > 0 && a.covered === 0 ? "noplan" : "ontrack";
    return Array.from(map.values());
  }, [data]);

  const counts = useMemo(() => {
    const c = { all: aggs.length, ahead: 0, ontrack: 0, behind: 0, noplan: 0 } as Record<string, number>;
    for (const a of aggs) c[a.status] += 1;
    return c;
  }, [aggs]);

  const q = search.trim().toLowerCase();
  const shown = aggs
    .filter((a) => (filter === "all" || a.status === filter) && (!q || `${a.name} ${a.rows.map((r) => `${r.class_name} ${r.subject_name}`).join(" ")}`.toLowerCase().includes(q)))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "progress" ? (a.total ? a.covered / a.total : -1) - (b.total ? b.covered / b.total : -1) : b.behind - a.behind || b.noPlan - a.noPlan || a.name.localeCompare(b.name)));

  function toggle(k: string) {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  const dateText = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Never");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-muted-foreground">Every teacher&apos;s lesson plans at a glance. The tick on each bar is where the term should be by now. Open a teacher to see each class and subject.</p>
        {terms.length > 0 && (
          <Select value={term} onValueChange={(v) => v && setTerm(v)}>
            <SelectTrigger className="h-10 w-full sm:w-48" aria-label="Term"><SelectValue /></SelectTrigger>
            <SelectContent>{terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : data?.coverage === null ? (
        <ErrorBox message="We couldn't load the lesson plan figures." onRetry={() => setReloadKey((k) => k + 1)} />
      ) : aggs.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No timetabled lessons or plans for this term yet.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
            {([
              ["all", "Teachers", counts.all, "with a timetable or plan"],
              ["ontrack", "On track", counts.ontrack + counts.ahead, "at or ahead of the term"],
              ["behind", "Behind", counts.behind, "topics fewer than expected"],
              ["noplan", "No plan", counts.noplan, "nothing planned this term"],
            ] as const).map(([k, label, value, sub]) => (
              <button key={k} type="button" aria-pressed={k !== "all" && (filter === k || (k === "ontrack" && filter === "ahead"))} onClick={() => setFilter(k === "all" ? "all" : filter === k ? "all" : (k as CovStatus))} className={`rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent/40 sm:p-4 ${k !== "all" && filter === k ? "border-primary ring-1 ring-primary" : ""}`}>
                <span className="block text-sm text-muted-foreground">{label}</span>
                <span className="block font-heading text-2xl font-semibold tabular-nums">{value}</span>
                <span className="block text-xs text-muted-foreground">{sub}</span>
              </button>
            ))}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teacher, class or subject..." aria-label="Search" className="h-10 pl-8" />
            </div>
            <div className="sm:ml-auto sm:w-52">
              <Select value={sort} onValueChange={(v) => v && setSort(v as typeof sort)}>
                <SelectTrigger className="h-10 w-full" aria-label="Sort"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="behind">Sort: most behind first</SelectItem>
                  <SelectItem value="progress">Sort: least covered first</SelectItem>
                  <SelectItem value="name">Sort: name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No teachers match.</p>
          ) : (
            <ul className="overflow-hidden rounded-xl border bg-card divide-y">
              {shown.map((a) => {
                const isOpen = open.has(a.key);
                const st = COV_LABEL[a.status];
                return (
                  <li key={a.key}>
                    <button type="button" aria-expanded={isOpen} onClick={() => toggle(a.key)} className="grid w-full gap-x-4 gap-y-2 px-4 py-3 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_6rem_minmax(0,1fr)_1.5rem] lg:items-center">
                      <span className="flex min-w-0 items-center gap-3">
                        <Initials name={a.name} seed={a.id ?? 0} size="sm" />
                        <span className="min-w-0"><span className="block font-medium break-words">{a.name}</span><span className="block text-xs text-muted-foreground">{a.rows.length} class{a.rows.length === 1 ? "" : "es"} and subjects</span></span>
                      </span>
                      <span>
                        <Meter value={a.covered} total={a.total} expected={a.expected} label={`${a.name} topics covered`} />
                        <span className="mt-1 block text-[11px] text-muted-foreground">{a.total ? `${a.covered} of ${a.total} topics${a.expected != null ? `, ${a.expected} expected by now` : ""}` : "No plan written yet"}</span>
                      </span>
                      <span className="flex items-center gap-2 lg:justify-start"><Pill tone={st.tone}>{st.label}{a.status === "behind" ? ` ${a.behind}` : ""}</Pill></span>
                      <span className="text-xs text-muted-foreground"><span className="font-medium text-foreground tabular-nums">{a.taught}</span> taught{a.partly > 0 ? `, ${a.partly} partly` : ""}{a.missed > 0 ? `, ${a.missed} missed` : ""}<span className="block">Last taught {dateText(a.last)}</span></span>
                      <ChevronDown className={`hidden size-4 text-muted-foreground transition-transform lg:block ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    {isOpen && (
                      <ul className="divide-y border-t bg-muted/20">
                        {a.rows.map((r) => (
                          <li key={`${r.class_id}-${r.subject_id}`} className="grid gap-x-4 gap-y-1.5 px-4 py-2.5 sm:px-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_6rem_minmax(0,1fr)_1.5rem] lg:items-center lg:pl-[4.75rem]">
                            <span className="text-sm"><span className="font-medium">{r.subject_name}</span> <span className="text-muted-foreground">· {r.class_name}</span></span>
                            <span>
                              {r.plan_id ? (
                                <>
                                  <Meter value={r.completed_count} total={r.entry_count} expected={r.expected_covered} label={`${r.subject_name} ${r.class_name} covered`} />
                                  <span className="mt-1 block text-[11px] text-muted-foreground">{r.completed_count} of {r.entry_count}{r.expected_covered != null ? `, ${r.expected_covered} expected` : ""}</span>
                                </>
                              ) : (
                                <span className="text-xs text-amber-700 dark:text-amber-400">No lesson plan this term</span>
                              )}
                            </span>
                            <span>{r.plan_id && <Link href={`/dashboard/lesson-plans/${r.plan_id}`} className="text-xs font-medium text-primary hover:underline">Open plan</Link>}</span>
                            <span className="text-xs text-muted-foreground">{r.taught} taught{r.not_taught ? `, ${r.not_taught} missed` : ""}</span>
                            <span className="lg:justify-self-end">
                              {a.id != null && canFeedback && (
                                <Button size="sm" variant="outline" className="h-9" onClick={() => setFeedbackFor({ teacherId: a.id as number, teacherName: a.name, topic: `Lesson plan: ${r.subject_name}, ${r.class_name}`, link: r.plan_id ? `/dashboard/lesson-plans/${r.plan_id}` : "/dashboard/lesson-plans" })}>
                                  <MessageSquarePlus /> Feedback
                                </Button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {feedbackFor && <FeedbackDialog {...feedbackFor} onClose={() => setFeedbackFor(null)} />}
        </>
      )}
    </div>
  );
}

function LessonPlansView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";
  const canRecord = user?.role === "super_admin" || isTeacher || user?.role === "staff";

  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [termFilter, setTermFilter] = useState("all");
  const [tabChoice, setTab] = useState<"plans" | "coverage" | null>(null);
  const [newOpen, setNewOpen] = useState(searchParams.get("new") === "1");

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
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

  const classNameOf = useMemo(() => {
    const m: Record<number, string> = {};
    for (const c of data?.classes ?? []) m[c.id] = c.name;
    return (id: number) => m[id] ?? "Class";
  }, [data]);
  const subjectNameOf = useMemo(() => {
    const m: Record<number, string> = {};
    for (const s of data?.subjects ?? []) m[s.id] = s.name;
    return (id: number) => m[id] ?? "Subject";
  }, [data]);

  if (loading || !data) {
    return failed ? null : <PageLoader />;
  }
  const tab = tabChoice ?? (isAdmin ? "coverage" : "plans");

  const q = search.trim().toLowerCase();
  const filtered = data.plans.filter((p) => {
    if (termFilter !== "all" && p.term !== termFilter) return false;
    if (!q) return true;
    return `${subjectNameOf(p.subject_id)} ${classNameOf(p.class_id)} ${p.term} ${p.created_by_name ?? ""}`.toLowerCase().includes(q);
  });
  const groups = Array.from(
    filtered.reduce((m, p) => m.set(classNameOf(p.class_id), [...(m.get(classNameOf(p.class_id)) ?? []), p]), new Map<string, LessonPlan[]>()),
  ).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  const totalTopics = data.plans.reduce((n, p) => n + p.entry_count, 0);
  const totalCovered = data.plans.reduce((n, p) => n + p.completed_count, 0);
  const resume = isTeacher ? data.plans.filter((p) => p.next_topic).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))[0] : undefined;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Lesson Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.plans.length} plan{data.plans.length === 1 ? "" : "s"}
            {totalTopics > 0 && <> · {totalCovered} of {totalTopics} topics covered</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isTeacher && (
            <Button variant="outline" className="h-10 sm:h-9" nativeButton={false} render={<Link href="/dashboard/lesson-plans/record"><FileText /> Record of work</Link>} />
          )}
          {canRecord && (
            <Button className="h-10 sm:h-9" onClick={() => setNewOpen(true)}>
              <Plus /> New plan
            </Button>
          )}
        </div>
      </header>

      {isAdmin && (
        <div role="tablist" aria-label="Sections" className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["coverage", "By teacher"],
              ["plans", "All plans"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`h-9 rounded-md text-sm font-medium transition-colors ${tab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isAdmin && tab === "coverage" ? (
        <CoverageView terms={data.terms} />
      ) : (
        <>
          {isTeacher && <TodayLessons />}

          {resume && (
            <Link
              href={`/dashboard/lesson-plans/${resume.id}`}
              className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 sm:p-5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookOpen className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">Continue where you left off</span>
                <span className="block font-medium break-words">{resume.next_topic}</span>
                <span className="block text-sm text-muted-foreground">{subjectNameOf(resume.subject_id)} · {classNameOf(resume.class_id)}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-heading text-lg font-semibold">{isAdmin ? "All plans" : "My plans"}</h2>
              {data.plans.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <div className="relative col-span-2 sm:w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plans..." aria-label="Search plans" className="h-10 pl-8 sm:h-9" />
                  </div>
                  {data.terms.length > 1 && (
                    <Select value={termFilter} onValueChange={(v) => v && setTermFilter(v)}>
                      <SelectTrigger className="h-10 w-full sm:h-9 sm:w-44" aria-label="Term"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All terms</SelectItem>
                        {data.terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {failed ? (
              <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
                <AlertTriangle className="size-6 text-red-600" />
                <p className="text-sm text-muted-foreground">We couldn&apos;t load the lesson plans.</p>
                <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
              </div>
            ) : data.plans.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
                <BookOpen className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">No lesson plans yet</p>
                <p className="text-xs text-muted-foreground">{canRecord ? "Start a plan for a class and subject, and it will appear here." : "Plans that teachers write will appear here."}</p>
                {canRecord && <Button size="sm" className="mt-2" onClick={() => setNewOpen(true)}><Plus /> New plan</Button>}
              </div>
            ) : groups.length === 0 ? (
              <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No plans match your search.</p>
            ) : (
              groups.map(([className, plans]) => (
                <div key={className} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{className}</h3>
                  <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                    {plans.map((p) => (
                      <li key={p.id}>
                        <Link href={`/dashboard/lesson-plans/${p.id}`} className="group flex items-center gap-3 px-4 py-3.5 transition-colors outline-none hover:bg-accent/50 focus-visible:bg-accent/50 sm:gap-4 sm:px-5">
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-medium break-words">{subjectNameOf(p.subject_id)}</span>
                              <span className="text-xs text-muted-foreground">{p.term}{isAdmin && p.created_by_name ? ` · ${p.created_by_name}` : ""}</span>
                            </span>
                            <span className="mt-2 block max-w-md"><ProgressLine done={p.completed_count} total={p.entry_count} /></span>
                            <span className="mt-1.5 block text-sm break-words text-muted-foreground">
                              {p.entry_count === 0 ? "No topics added yet" : p.next_topic ? <>Next: <span className="text-foreground">{p.next_topic}</span></> : "Every topic covered"}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {newOpen && canRecord && (
        <NewPlanDialog
          data={data}
          isTeacher={isTeacher}
          initial={{ classId: searchParams.get("class") ?? "", subjectId: searchParams.get("subject") ?? "" }}
          onClose={() => setNewOpen(false)}
        />
      )}
    </div>
  );
}

export default function LessonPlansPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LessonPlansView />
    </Suspense>
  );
}
