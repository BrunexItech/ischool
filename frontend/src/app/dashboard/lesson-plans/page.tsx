"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, BookOpen, ChevronRight, FileText, Plus, RotateCw, Search } from "lucide-react";
import { api, AcademicTerm, ApiError, Coverage, LessonPlan, MyClass, SchoolClass, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { TodayLessons } from "@/components/TodayLessons";
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

function CoverageView({ terms }: { terms: AcademicTerm[] }) {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [term, setTerm] = useState(terms.find((t) => t.is_current)?.name ?? terms[0]?.name ?? "");
  const [data, setData] = useState<{ key: string; coverage: Coverage | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
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
  const rows = data?.coverage?.rows ?? [];
  const reasonLabel: Record<string, string> = { teacher_absent: "away", public_holiday: "holiday", exams: "exams", school_event: "event", other: "other" };

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="font-heading text-lg font-semibold">Syllabus coverage</h2>
          <p className="text-sm text-muted-foreground">How far each teacher has got, against where the term should be by now.</p>
        </div>
        {terms.length > 0 && (
          <Select value={term} onValueChange={(v) => v && setTerm(v)}>
            <SelectTrigger className="h-10 w-full sm:h-9 sm:w-48" aria-label="Term"><SelectValue /></SelectTrigger>
            <SelectContent>{terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      {loading ? (
        <div className="py-10"><PageLoader /></div>
      ) : data?.coverage === null ? (
        <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the coverage figures.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">No timetabled lessons or plans for this term yet.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => {
            const pct = r.entry_count ? (r.completed_count / r.entry_count) * 100 : 0;
            const expectedPct = r.expected_covered !== null && r.entry_count ? (r.expected_covered / r.entry_count) * 100 : null;
            const behind = r.expected_covered !== null && r.completed_count < r.expected_covered;
            const missed = Object.entries(r.reasons).map(([k, v]) => `${v} ${reasonLabel[k] ?? k}`).join(", ");
            return (
              <li key={`${r.teacher_user_id}-${r.class_id}-${r.subject_id}`} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-6">
                <div className="min-w-0">
                  <p className="font-medium break-words">{r.teacher_name}</p>
                  <p className="text-sm text-muted-foreground">{r.subject_name} · {r.class_name}</p>
                </div>
                <div>
                  {r.plan_id ? (
                    <>
                      <div className="relative h-1.5 rounded-full bg-muted" role="progressbar" aria-valuenow={r.completed_count} aria-valuemin={0} aria-valuemax={r.entry_count} aria-label="Topics covered">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        {expectedPct !== null && <span className="absolute -top-1 h-3.5 w-0.5 bg-foreground/60" style={{ left: `${Math.min(100, expectedPct)}%` }} title="Where the term should be by now" aria-hidden />}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {r.completed_count} of {r.entry_count} topics covered
                        {r.expected_covered !== null && <> · expected {r.expected_covered} by now{behind && <strong className="text-foreground"> ({r.expected_covered - r.completed_count} behind)</strong>}</>}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No lesson plan for this term yet.</p>
                  )}
                </div>
                <div className="text-sm">
                  <p>
                    <span className="font-medium tabular-nums">{r.taught}</span> taught
                    {r.partly > 0 && <> · {r.partly} partly</>}
                    {r.not_taught > 0 && <> · {r.not_taught} not taught</>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {missed ? `Missed: ${missed}. ` : ""}
                    {r.last_taught ? `Last taught ${new Date(r.last_taught + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Nothing marked yet"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
  const [tab, setTab] = useState<"plans" | "coverage">("plans");
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
              ["plans", "Plans"],
              ["coverage", "Coverage"],
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
