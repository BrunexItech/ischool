"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Mail, Phone, Search } from "lucide-react";
import { api, TeacherCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ErrorBox, Initials, Meter, PageHead, Pill } from "@/components/oversight";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const TODAY: Record<string, { label: string; tone: "good" | "warn" | "bad" | "muted" | "info" }> = {
  present: { label: "In today", tone: "good" },
  late: { label: "Late today", tone: "warn" },
  absent: { label: "Absent today", tone: "bad" },
  on_leave: { label: "On leave", tone: "muted" },
  expected: { label: "Not in yet", tone: "info" },
};

const NO_CATEGORY = "Not allocated yet";

function behindBy(t: TeacherCard) {
  return t.topics_expected != null ? Math.max(0, t.topics_expected - t.topics_covered) : 0;
}

function todayPill(t: TeacherCard) {
  if (!t.today) return <Pill tone="muted">No school today</Pill>;
  const m = TODAY[t.today];
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

function planNote(t: TeacherCard) {
  if (t.plans === 0) return <span className="text-amber-700 dark:text-amber-400">No lesson plan</span>;
  const b = behindBy(t);
  return b > 0 ? <span className="font-medium text-amber-700 dark:text-amber-400">{b} behind</span> : <span className="text-muted-foreground">On track</span>;
}

export default function TeachersPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [data, setData] = useState<TeacherCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && user && user.role !== "head_of_institution" && user.role !== "group_principal" && user.role !== "super_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.getTeacherCards(token, schoolId).then((d) => { if (!cancelled) { setData(d); setFailed(false); } }).catch(() => { if (!cancelled) { setData([]); setFailed(true); } });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, reloadKey]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of data ?? []) (t.categories.length ? t.categories : [NO_CATEGORY]).forEach((c) => set.add(c));
    return Array.from(set).sort((a, b) => (a === NO_CATEGORY ? 1 : b === NO_CATEGORY ? -1 : a.localeCompare(b)));
  }, [data]);

  if (loading || !data) return <PageLoader />;

  const q = search.trim().toLowerCase();
  const shown = data
    .filter((t) => (category === "all" || (t.categories.length ? t.categories : [NO_CATEGORY]).includes(category)))
    .filter((t) => status === "all" || (status === "away" ? t.today === "absent" || t.today === "on_leave" : status === "in" ? t.today === "present" || t.today === "late" : status === "behind" ? behindBy(t) > 0 : status === "noplan" ? t.plans === 0 : true))
    .filter((t) => !q || `${t.name} ${t.email} ${t.subjects.join(" ")} ${t.classes.join(" ")} ${t.tsc_number ?? ""} ${t.staff_number ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => (sort === "behind" ? behindBy(b) - behindBy(a) || a.name.localeCompare(b.name) : sort === "marked" ? a.lessons_marked_week / Math.max(1, a.lessons_scheduled_week) - b.lessons_marked_week / Math.max(1, b.lessons_scheduled_week) : a.name.localeCompare(b.name)));

  const inToday = data.filter((t) => t.today === "present" || t.today === "late").length;
  const away = data.filter((t) => t.today === "absent" || t.today === "on_leave").length;
  const behind = data.filter((t) => behindBy(t) > 0).length;
  const noPlan = data.filter((t) => t.plans === 0).length;
  const open = data.find((t) => t.user_id === openId) ?? null;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Teachers" subtitle={`${data.length} teacher${data.length === 1 ? "" : "s"} · who they are, what they teach and how the week is going`} />

      {failed ? (
        <ErrorBox message="We couldn't load the teachers." onRetry={() => setReloadKey((k) => k + 1)} />
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-14 text-center text-sm text-muted-foreground">No teachers have been added yet. Add them under Staff.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Summary">
            {[
              ["Teachers", String(data.length), "on the staff list", "all"],
              ["In today", String(inToday), "scanned in or took a register", "in"],
              ["Away today", String(away), "absent or on leave", "away"],
              ["Behind on syllabus", String(behind), "against where the term should be", "behind"],
              ["No lesson plan", String(noPlan), "for this term", "noplan"],
            ].map(([label, value, sub, key]) => (
              <button key={label} type="button" onClick={() => setStatus(status === key ? "all" : key)} aria-pressed={status === key && key !== "all"} className={`rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent/40 sm:p-4 ${status === key && key !== "all" ? "border-primary ring-1 ring-primary" : ""}`}>
                <span className="block text-sm text-muted-foreground">{label}</span>
                <span className="block font-heading text-2xl font-semibold tabular-nums">{value}</span>
                <span className="block text-xs text-muted-foreground">{sub}</span>
              </button>
            ))}
          </section>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, subject, class or TSC number..." aria-label="Search teachers" className="h-10 pl-8" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
              {["all", ...categories].map((c) => (
                <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {c === "all" ? "All teachers" : c}
                </button>
              ))}
            </div>
            <div className="lg:ml-auto lg:w-52">
              <Select value={sort} onValueChange={(v) => v && setSort(v)}>
                <SelectTrigger className="h-10 w-full" aria-label="Sort"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: name</SelectItem>
                  <SelectItem value="behind">Sort: most behind first</SelectItem>
                  <SelectItem value="marked">Sort: fewest lessons marked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No teachers match.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {shown.map((t) => (
                <button key={t.user_id} type="button" onClick={() => setOpenId(t.user_id)} className="group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-start gap-3">
                    <Initials name={t.name} seed={t.user_id} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium break-words">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.categories.length ? t.categories.join(" · ") : NO_CATEGORY}{t.department ? ` · ${t.department}` : ""}</span>
                    </span>
                    {todayPill(t)}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {t.class_teacher_of.map((c) => <span key={`ct-${c}`} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Class teacher: {c}</span>)}
                    {t.classes.filter((c) => !t.class_teacher_of.includes(c)).slice(0, 3).map((c) => <span key={c} className="rounded-full border px-2 py-0.5 text-xs">{c}</span>)}
                    {t.classes.filter((c) => !t.class_teacher_of.includes(c)).length > 3 && <span className="px-1 text-xs text-muted-foreground">+{t.classes.filter((c) => !t.class_teacher_of.includes(c)).length - 3} more</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.subjects.length ? t.subjects.join(", ") : "No subjects allocated"}</span>
                  <span>
                    <Meter value={t.topics_covered} total={t.topics_total} expected={t.topics_expected} label={`${t.name} syllabus covered`} />
                    <span className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t.topics_total ? `${t.topics_covered} of ${t.topics_total} topics` : "No plan"}</span>
                      {planNote(t)}
                    </span>
                  </span>
                  <span className="grid grid-cols-2 gap-2 border-t pt-3 text-center text-xs">
                    <span><span className="block font-heading text-base font-semibold tabular-nums">{t.lessons_marked_week}<span className="text-muted-foreground">/{t.lessons_scheduled_week}</span></span><span className="text-muted-foreground">lessons marked this week</span></span>
                    <span><span className="block font-heading text-base font-semibold tabular-nums">{t.homework_week}</span><span className="text-muted-foreground">homework this week</span></span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          {open && (
            <>
              <SheetHeader className="items-center gap-3 border-b bg-muted/30 pt-8 pb-5 text-center">
                <Initials name={open.name} seed={open.user_id} size="lg" />
                <div>
                  <SheetTitle className="font-heading text-xl break-words">{open.name}</SheetTitle>
                  <SheetDescription>{open.categories.length ? open.categories.join(" · ") : NO_CATEGORY}</SheetDescription>
                </div>
                {todayPill(open)}
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-8">
                <section className="rounded-xl border p-4">
                  <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contact</p>
                  <div className="flex flex-col gap-2">
                    {open.phone ? <Button variant="outline" className="h-11 justify-start" nativeButton={false} render={<a href={`tel:${open.phone}`}><Phone /> {open.phone}</a>} /> : <p className="text-sm text-muted-foreground">No phone number recorded.</p>}
                    <Button variant="outline" className="h-11 justify-start" nativeButton={false} render={<a href={`mailto:${open.email}`}><Mail /> <span className="break-all">{open.email}</span></a>} />
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-muted-foreground">Staff number</dt><dd className="font-medium">{open.staff_number ?? "—"}</dd>
                    <dt className="text-muted-foreground">TSC number</dt><dd className="font-medium">{open.tsc_number ?? "—"}</dd>
                    <dt className="text-muted-foreground">Department</dt><dd className="font-medium">{open.department ?? "—"}</dd>
                  </dl>
                </section>

                <section className="rounded-xl border p-4">
                  <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">What they teach</p>
                  {open.class_teacher_of.length > 0 && <p className="mb-2 text-sm"><span className="text-muted-foreground">Class teacher of </span><span className="font-medium">{open.class_teacher_of.join(", ")}</span></p>}
                  <div className="flex flex-wrap gap-1.5">{open.classes.length ? open.classes.map((c) => <span key={c} className="rounded-full border px-2.5 py-0.5 text-xs font-medium">{c}</span>) : <span className="text-sm text-muted-foreground">No classes allocated.</span>}</div>
                  <p className="mt-3 text-sm">{open.subjects.length ? open.subjects.join(", ") : <span className="text-muted-foreground">No subjects allocated.</span>}</p>
                </section>

                <section className="rounded-xl border p-4">
                  <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">This term and this week</p>
                  <Meter value={open.topics_covered} total={open.topics_total} expected={open.topics_expected} label="Syllabus covered" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {open.topics_total ? `${open.topics_covered} of ${open.topics_total} topics covered${open.topics_expected != null ? `, ${open.topics_expected} expected by now` : ""}` : "No lesson plan for this term."}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg bg-muted/50 py-2"><dt className="text-[11px] text-muted-foreground">Lessons marked</dt><dd className="font-heading text-lg font-semibold tabular-nums">{open.lessons_marked_week} of {open.lessons_scheduled_week}</dd></div>
                    <div className="rounded-lg bg-muted/50 py-2"><dt className="text-[11px] text-muted-foreground">Homework given</dt><dd className="font-heading text-lg font-semibold tabular-nums">{open.homework_week}</dd></div>
                  </dl>
                </section>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/dashboard/lesson-plans">Lesson plans <ChevronRight /></Link>} />
                  <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/dashboard/staff-attendance">Attendance <ChevronRight /></Link>} />
                  <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/dashboard/timetable">Timetable <ChevronRight /></Link>} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
