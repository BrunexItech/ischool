"use client";

import { useGoToTab, useModuleTab } from "@/lib/moduleTabs";
import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, ChevronRight, Plus, Search, Users } from "lucide-react";
import { api, ApiError, ClassCard, ClassDetail, GradeLevel, SchoolClass, Staff } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ErrorBox, Initials, LEVEL_BAR, LEVEL_LABEL, LEVEL_ORDER, Meter, PageHead, Pill } from "@/components/oversight";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const GRADUATE = "graduate";
const NO_TEACHER = "none";

function registerPill(c: ClassCard) {
  if (c.register_today === "not_a_school_day") return <Pill tone="muted">No school today</Pill>;
  return c.register_today === "taken" ? <Pill tone="good">Register taken</Pill> : <Pill tone="warn">Register not taken</Pill>;
}

function PromoteDialog({ card, others, onClose, onDone }: { card: ClassCard; others: ClassCard[]; onClose: () => void; onDone: () => void }) {
  const { token, user } = useAuth();
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  async function promote() {
    if (!token || !user?.school_id || !target) return;
    setSaving(true);
    try {
      const result = await api.promoteClass(token, user.school_id, card.id, target === GRADUATE ? null : Number(target));
      toast.success(result.graduated ? `${result.moved_count} learner(s) graduated` : `${result.moved_count} learner(s) promoted`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to promote class");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Promote {card.name}</DialogTitle>
          <DialogDescription>Moves every active learner out of {card.name}. This cannot be undone in bulk; learners would have to be moved back one by one.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Move to</Label>
          <Select value={target} onValueChange={(v) => v && setTarget(v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select a class" /></SelectTrigger>
            <SelectContent>
              {others.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              <SelectItem value={GRADUATE}>Graduate (leaving the school)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={promote} disabled={saving || !target}>{saving && <Spinner size={16} className="text-current" />} Confirm promotion</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClassSheet({
  classId,
  cards,
  teachers,
  canManage,
  onClose,
  onChanged,
}: {
  classId: number | null;
  cards: ClassCard[];
  teachers: Staff[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [data, setData] = useState<{ id: number; detail: ClassDetail | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [promoting, setPromoting] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);

  useEffect(() => {
    if (!token || !schoolId || classId === null) return;
    let cancelled = false;
    api.getClassDetail(token, schoolId, classId).then((detail) => !cancelled && setData({ id: classId, detail })).catch(() => !cancelled && setData({ id: classId, detail: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, classId, reload]);

  const detail = data && data.id === classId ? data.detail : null;
  const loading = classId !== null && (!data || data.id !== classId);
  const card = detail?.card;

  async function changeTeacher(value: string) {
    if (!token || !schoolId || classId === null) return;
    setSavingTeacher(true);
    try {
      await api.updateClass(token, schoolId, classId, { homeroom_teacher_id: value === NO_TEACHER ? null : Number(value) });
      toast.success(value === NO_TEACHER ? "Class teacher removed" : "Class teacher assigned");
      setReload((n) => n + 1);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update the class teacher");
    } finally {
      setSavingTeacher(false);
    }
  }

  return (
    <Sheet open={classId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b bg-muted/30 pb-4">
          <SheetTitle className="font-heading text-xl break-words">{card?.name ?? cards.find((c) => c.id === classId)?.name ?? "Class"}</SheetTitle>
          <SheetDescription>{card ? `${card.grade_name ?? "Class"}${detail?.term ? ` · ${detail.term}` : ""}` : "Loading..."}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <PageLoader />
        ) : !detail || !card ? (
          <div className="p-4"><ErrorBox message="We couldn't load this class." onRetry={() => setReload((n) => n + 1)} /></div>
        ) : (
          <div className="flex flex-col gap-5 px-4 pb-8">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Class at a glance">
              {[
                ["Learners", String(card.learners), `${detail.boys} boys · ${detail.girls} girls`],
                ["Attendance", card.attendance_rate != null ? `${card.attendance_rate}%` : "—", card.attendance_date ? `on ${new Date(card.attendance_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "No register yet"],
                ["Average", card.average != null ? String(card.average) : "—", detail.term ?? "No term set"],
                ["Syllabus", card.topics_total ? `${Math.round((card.topics_covered / card.topics_total) * 100)}%` : "—", card.topics_total ? `${card.topics_covered} of ${card.topics_total} topics` : "No plans yet"],
              ].map(([label, value, sub]) => (
                <div key={label} className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-heading text-xl font-semibold tabular-nums">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{sub}</p>
                </div>
              ))}
            </section>

            <section className="rounded-xl border p-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Class teacher</p>
              {canManage ? (
                <Select value={card.homeroom_teacher_id ? String(card.homeroom_teacher_id) : NO_TEACHER} onValueChange={(v) => v && changeTeacher(v)} disabled={savingTeacher}>
                  <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEACHER}>Not assigned</SelectItem>
                    {teachers.map((t) => <SelectItem key={t.user_id} value={String(t.user_id)}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{card.homeroom_teacher_name ?? "Not assigned"}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {registerPill(card)}
                {card.open_conduct > 0 && <Pill tone="warn">{card.open_conduct} open conduct report{card.open_conduct === 1 ? "" : "s"}</Pill>}
                <Pill tone="muted">{card.homework_this_week} homework this week</Pill>
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-heading text-base font-semibold">Subjects and teachers</h3>
              {detail.teacher_rows.length === 0 ? (
                <EmptyNote>No subjects have been allocated to this class yet. Allocate them under Teaching Assignments.</EmptyNote>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {detail.teacher_rows.map((r) => (
                    <li key={`${r.subject_id}-${r.teacher_id}`} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{r.subject}</p>
                          <p className="text-xs text-muted-foreground">{r.teacher ?? "No teacher"}{r.last_taught ? ` · last taught ${new Date(r.last_taught + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{r.homework_this_week} homework</span>
                      </div>
                      {r.topics_total > 0 ? (
                        <div><Meter value={r.topics_covered} total={r.topics_total} label={`${r.subject} topics covered`} /><p className="mt-1 text-[11px] text-muted-foreground">{r.topics_covered} of {r.topics_total} topics covered</p></div>
                      ) : (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">No lesson plan for this term</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {detail.attendance_days.length > 0 && (
              <section>
                <h3 className="mb-2 font-heading text-base font-semibold">Attendance, recent days</h3>
                <div className="flex h-24 items-end gap-1.5 rounded-xl border p-3" role="img" aria-label="Attendance rate for recent registers">
                  {detail.attendance_days.map((d) => (
                    <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${d.rate}%`}>
                      <div className={`w-full rounded-t ${d.rate >= 95 ? "bg-emerald-500" : d.rate >= 85 ? "bg-amber-400" : "bg-red-400"}`} style={{ height: `${Math.max(6, d.rate)}%` }} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {detail.subject_averages.length > 0 && (
              <section>
                <h3 className="mb-2 font-heading text-base font-semibold">Results by subject</h3>
                <ul className="flex flex-col gap-2 rounded-xl border p-4">
                  {detail.subject_averages.map((s) => (
                    <li key={s.subject} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
                      <span className="truncate">{s.subject}</span>
                      <span className="h-1.5 rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${s.average}%` }} /></span>
                      <span className="text-right font-medium tabular-nums">{s.average}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-2 font-heading text-base font-semibold">Learners ({detail.learners_list.length})</h3>
              {detail.learners_list.length === 0 ? (
                <EmptyNote>No learners in this class yet.</EmptyNote>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {detail.learners_list.map((l, i) => (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-6 text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium break-words">{l.name}</span>
                        <span className="block text-xs text-muted-foreground">Adm. {l.admission_number}</span>
                      </span>
                      <span className={`w-14 text-right text-xs tabular-nums ${l.attendance_rate != null && l.attendance_rate < 80 ? "font-semibold text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{l.attendance_rate != null ? `${l.attendance_rate}%` : "—"}</span>
                      <span className={`w-10 text-right text-sm font-medium tabular-nums ${l.average != null && l.average < 40 ? "text-red-700 dark:text-red-400" : ""}`}>{l.average ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">Columns: attendance this term, average mark.</p>
            </section>

            {detail.homework.length > 0 && (
              <section>
                <h3 className="mb-2 font-heading text-base font-semibold">Recent homework</h3>
                <ul className="divide-y rounded-xl border">
                  {detail.homework.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0"><p className="text-sm font-medium break-words">{h.title}</p><p className="text-xs text-muted-foreground">{h.subject}{h.teacher ? ` · ${h.teacher}` : ""}</p></div>
                      {h.given_on_board ? <Pill tone="info">On the board</Pill> : <Pill tone="muted">Typed</Pill>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {detail.conduct.length > 0 && (
              <section>
                <h3 className="mb-2 font-heading text-base font-semibold">Conduct</h3>
                <ul className="divide-y rounded-xl border">
                  {detail.conduct.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0 break-words">{c.student_name} <span className="text-muted-foreground">· {c.category.replace(/_/g, " ")}</span></span>
                      <Pill tone={c.status === "reviewed" ? "good" : "warn"}>{c.status === "reviewed" ? "Reviewed" : "Open"}</Pill>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-10" nativeButton={false} render={<Link href={`/dashboard/results/board?class_id=${card.id}`}>Results board</Link>} />
              <Button variant="outline" className="h-10" nativeButton={false} render={<Link href={`/dashboard/students?class_id=${card.id}`}><Users /> Learners</Link>} />
              {canManage && <Button variant="outline" className="h-10" onClick={() => setPromoting(true)}><ArrowUpRight /> Promote class</Button>}
            </div>
            {promoting && <PromoteDialog card={card} others={cards.filter((c) => c.id !== card.id)} onClose={() => setPromoting(false)} onDone={() => { setReload((n) => n + 1); onChanged(); }} />}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function GradesSetup({ grades, enabledIds, classes, onChanged }: { grades: GradeLevel[]; enabledIds: Set<number>; classes: SchoolClass[]; onChanged: () => void }) {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const grouped = useMemo(() => {
    const g: Record<string, GradeLevel[]> = {};
    for (const x of grades) (g[x.level_group] ??= []).push(x);
    return g;
  }, [grades]);

  async function toggle(grade: GradeLevel, on: boolean) {
    if (!token || !schoolId) return;
    const next = new Set(enabledIds);
    if (on) next.add(grade.id);
    else next.delete(grade.id);
    setBusy(grade.id);
    try {
      await api.setEnabledGrades(token, schoolId, Array.from(next));
      toast.success(on ? `${grade.display_name} switched on` : `${grade.display_name} switched off`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the grades");
    } finally {
      setBusy(null);
    }
  }

  async function addStreams(grade: GradeLevel) {
    if (!token || !schoolId) return;
    const names = (drafts[grade.id] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    setBusy(grade.id);
    try {
      const r = await api.addStreams(token, schoolId, grade.id, names);
      if (r.created.length) toast.success(`Added ${r.created.join(", ")}`);
      if (r.skipped.length) toast.info(`Already existed: ${r.skipped.join(", ")}`);
      setDrafts((d) => ({ ...d, [grade.id]: "" }));
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add the classes");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">Switch on the grades your school has. Then add a class for each stream under it. Type the stream name only: &ldquo;Chui&rdquo; under Grade 3 becomes &ldquo;Grade 3 Chui&rdquo;. Separate several with commas. Leave it empty to add the grade as a single class.</p>
      {LEVEL_ORDER.filter((l) => grouped[l]).map((level) => (
        <section key={level} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5">
            <span className={`h-5 w-1.5 rounded-full ${LEVEL_BAR[level]}`} aria-hidden />
            <h2 className="font-heading text-lg font-semibold">{LEVEL_LABEL[level]}</h2>
          </div>
          <ul className="divide-y">
            {grouped[level].map((g) => {
              const on = enabledIds.has(g.id);
              const mine = classes.filter((c) => c.grade_level_id === g.id);
              return (
                <li key={g.id} className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-3">
                    <Switch checked={on} disabled={busy === g.id} onCheckedChange={(v) => toggle(g, v)} aria-label={`${g.display_name} offered`} />
                    <span className="flex-1 font-medium">{g.display_name}</span>
                    {on && <span className="text-xs text-muted-foreground">{mine.length} class{mine.length === 1 ? "" : "es"}</span>}
                  </div>
                  {on && (
                    <div className="flex flex-col gap-2 pl-0 sm:pl-12">
                      {mine.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {mine.map((c) => <span key={c.id} className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">{c.name}</span>)}
                        </div>
                      )}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          addStreams(g);
                        }}
                        className="flex flex-col gap-2 sm:flex-row"
                      >
                        <Input value={drafts[g.id] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [g.id]: e.target.value }))} placeholder={`Stream names, e.g. Chui, Simba`} aria-label={`New ${g.display_name} streams`} className="h-10" />
                        <Button type="submit" variant="outline" className="h-10" disabled={busy === g.id}><Plus /> Add</Button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function ClassesPage() {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const canManage = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal" || user?.role === "secretary";

  const [cards, setCards] = useState<ClassCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [enabled, setEnabled] = useState<Set<number>>(new Set());
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const tab = useModuleTab("classes") as "classes" | "setup";
  const setTab = useGoToTab() as (k: "classes" | "setup") => void;
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    let cardsFailed = false;
    Promise.all([
      api.getClassCards(token, schoolId).catch(() => {
        cardsFailed = true;
        return [] as ClassCard[];
      }),
      api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
      api.listGradeLevels(token).catch(() => [] as GradeLevel[]),
      api.listEnabledGrades(token, schoolId).catch(() => [] as GradeLevel[]),
      canManage ? api.listStaff(token, schoolId).catch(() => [] as Staff[]) : Promise.resolve([] as Staff[]),
    ]).then(([c, cl, gr, en, st]) => {
      if (cancelled) return;
      setCards(c);
      setFailed(cardsFailed);
      setClasses(cl);
      setGrades(gr);
      setEnabled(new Set(en.map((g) => g.id)));
      setTeachers(st.filter((x) => x.role === "teacher"));
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, canManage, reloadKey]);

  if (!cards) return <PageLoader />;

  const q = search.trim().toLowerCase();
  const visible = cards.filter((c) => (level === "all" || c.level === level) && (!q || `${c.name} ${c.homeroom_teacher_name ?? ""}`.toLowerCase().includes(q)));
  const groups = LEVEL_ORDER.map((l) => ({ level: l, items: visible.filter((c) => c.level === l) })).filter((g) => g.items.length > 0);
  const totalLearners = cards.reduce((n, c) => n + c.learners, 0);
  const taken = cards.filter((c) => c.register_today === "taken").length;
  const schoolDay = cards.some((c) => c.register_today !== "not_a_school_day");
  const noTeacher = cards.filter((c) => !c.homeroom_teacher_id).length;
  const present = LEVEL_ORDER.filter((l) => cards.some((c) => c.level === l));

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Classes" subtitle={`${cards.length} class${cards.length === 1 ? "" : "es"} · ${totalLearners} learners`}>
      </PageHead>

      {tab === "setup" && canManage ? (
        <GradesSetup grades={grades} enabledIds={enabled} classes={classes} onChanged={() => setReloadKey((k) => k + 1)} />
      ) : failed ? (
        <ErrorBox message="We couldn't load the classes." onRetry={() => setReloadKey((k) => k + 1)} />
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No classes yet</p>
          {canManage ? (
            <>
              <p className="max-w-sm text-xs text-muted-foreground">Start by switching on the grades your school has, then add a class for each stream.</p>
              <Button size="sm" className="mt-2" onClick={() => setTab("setup")}>Set up grades and streams</Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">The head of institution adds the school&apos;s classes.</p>
          )}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
            {[
              ["Classes", String(cards.length), `${present.length} level${present.length === 1 ? "" : "s"}`],
              ["Learners", String(totalLearners), "currently enrolled"],
              ["Registers today", schoolDay ? `${taken} of ${cards.length}` : "—", schoolDay ? (taken === cards.length ? "All taken" : `${cards.length - taken} still to take`) : "Not a school day"],
              ["Without a class teacher", String(noTeacher), noTeacher ? "Assign one from the class" : "Every class has one"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border bg-card p-3.5 sm:p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a class or teacher..." aria-label="Search classes" className="h-10 pl-8" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Level">
              {["all", ...present].map((l) => (
                <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${level === l ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {l === "all" ? "All levels" : LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <EmptyNote>No classes match.</EmptyNote>
          ) : (
            groups.map((g) => (
              <section key={g.level} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={`h-5 w-1.5 rounded-full ${LEVEL_BAR[g.level]}`} aria-hidden />
                  <h2 className="font-heading text-lg font-semibold">{LEVEL_LABEL[g.level]}</h2>
                  <span className="text-sm text-muted-foreground">{g.items.length} class{g.items.length === 1 ? "" : "es"} · {g.items.reduce((n, c) => n + c.learners, 0)} learners</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                  {g.items.map((c, i) => (
                    <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
                      <span className={`absolute inset-y-0 left-0 w-1.5 ${LEVEL_BAR[c.level]}`} aria-hidden />
                      <span className="flex items-start gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-heading text-base font-semibold break-words">{c.name}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                            {c.homeroom_teacher_name ? <><Initials name={c.homeroom_teacher_name} seed={i} size="sm" /> <span className="truncate">{c.homeroom_teacher_name}</span></> : <span className="text-amber-700 dark:text-amber-400">No class teacher</span>}
                          </span>
                        </span>
                        <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                      <span className="grid grid-cols-3 gap-2 text-center">
                        <span className="rounded-lg bg-muted/50 py-1.5"><span className="block font-heading text-lg leading-tight font-semibold tabular-nums">{c.learners}</span><span className="block text-[11px] text-muted-foreground">learners</span></span>
                        <span className="rounded-lg bg-muted/50 py-1.5"><span className="block font-heading text-lg leading-tight font-semibold tabular-nums">{c.attendance_rate != null ? `${c.attendance_rate}%` : "—"}</span><span className="block text-[11px] text-muted-foreground">attendance</span></span>
                        <span className="rounded-lg bg-muted/50 py-1.5"><span className="block font-heading text-lg leading-tight font-semibold tabular-nums">{c.average ?? "—"}</span><span className="block text-[11px] text-muted-foreground">average</span></span>
                      </span>
                      <span>
                        <Meter value={c.topics_covered} total={c.topics_total} label={`${c.name} syllabus covered`} />
                        <span className="mt-1 block text-[11px] text-muted-foreground">{c.topics_total ? `${c.topics_covered} of ${c.topics_total} topics covered` : "No lesson plans yet"}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {registerPill(c)}
                        {c.open_conduct > 0 && <Pill tone="warn">{c.open_conduct} open</Pill>}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      <ClassSheet classId={openId} cards={cards} teachers={teachers} canManage={canManage} onClose={() => setOpenId(null)} onChanged={() => setReloadKey((k) => k + 1)} />
    </div>
  );
}
