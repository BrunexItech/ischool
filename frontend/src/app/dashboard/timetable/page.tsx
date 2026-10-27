"use client";

import { useGoToTab, useModuleTab } from "@/lib/moduleTabs";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coffee, Plus, Trash2, Utensils } from "lucide-react";
import { api, ApiError, GradeLevel, SchoolClass, SchoolPeriod, Staff, Subject, TimetableSlot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHead, Pill } from "@/components/oversight";
import { PendingApprovals } from "@/components/PendingApprovals";
import { SchoolDayEditor } from "@/components/SchoolDayEditor";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const KIND_LABEL: Record<string, string> = { lesson: "Lesson", prep: "Prep", break: "Break", lunch: "Lunch", assembly: "Assembly", games: "Games" };
const TEACHABLE = ["lesson", "prep"];

const SUBJECT_COLORS = [
  "border-l-blue-500 bg-blue-500/5",
  "border-l-emerald-500 bg-emerald-500/5",
  "border-l-amber-500 bg-amber-500/5",
  "border-l-violet-500 bg-violet-500/5",
  "border-l-rose-500 bg-rose-500/5",
  "border-l-cyan-500 bg-cyan-500/5",
];

const hhmm = (t: string) => t.slice(0, 5);

function PlaceDialog({
  cls,
  period,
  day,
  subjects,
  teachers,
  busy,
  onClose,
  onCreated,
}: {
  cls: SchoolClass;
  period: SchoolPeriod;
  day: number;
  subjects: Subject[];
  teachers: Staff[];
  busy: Map<number, string>;
  onClose: () => void;
  onCreated: (slot: TimetableSlot) => void;
}) {
  const { token, user } = useAuth();
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !subjectId) return;
    setSaving(true);
    try {
      const created = await api.createTimetableSlot(token, user.school_id, {
        class_id: cls.id,
        subject_id: Number(subjectId),
        teacher_user_id: teacherId ? Number(teacherId) : undefined,
        day_of_week: day,
        period_id: period.id,
      });
      toast.success("Lesson added");
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't add the lesson.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{cls.name}, {DAYS[day]}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm"><span className="font-medium">{period.name}</span> · {hhmm(period.start_time)} to {hhmm(period.end_time)}. The time is fixed by the school day; you only choose the subject and teacher.</p>
          <div className="flex flex-col gap-1.5">
            <Label>Subject</Label>
            <Select required value={subjectId} onValueChange={(v) => v && setSubjectId(v)}>
              <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose a subject" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            {subjects.length === 0 && <p className="text-xs text-amber-700 dark:text-amber-400">No subject is set up for this grade. Add it under Subjects first.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={(v) => setTeacherId(v ?? "")}>
              <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose a teacher" /></SelectTrigger>
              <SelectContent>
                {teachers.map((t) => {
                  const clash = busy.get(t.user_id);
                  return <SelectItem key={t.user_id} value={String(t.user_id)} disabled={!!clash}>{t.full_name}{clash ? ` · teaching ${clash}` : ""}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Teachers already teaching another class in this block are greyed out.</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-11 sm:h-9" disabled={!subjectId || saving}>{saving && <Spinner size={16} className="text-current" />} Add lesson</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TimetablePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [everySlot, setEverySlot] = useState<TimetableSlot[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const tab = (useModuleTab("timetable") || "week") as "week" | "day";
  const setTab = useGoToTab() as (k: "week" | "day") => void;
  const [placing, setPlacing] = useState<{ period: SchoolPeriod; day: number } | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "super_admin", "group_principal", "secretary"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    Promise.all([
      api.listClasses(token, schoolId),
      api.listGradeLevels(token),
      api.listSubjects(token, schoolId),
      api.listStaff(token, schoolId),
      api.listSchoolPeriods(token, schoolId).catch(() => [] as SchoolPeriod[]),
      api.listTimetable(token, schoolId),
    ])
      .then(([cs, gs, ss, staff, ps, slots]) => {
        if (cancelled) return;
        setClasses(cs);
        setGrades(gs);
        setSubjects(ss);
        setTeachers(staff.filter((s) => s.role === "teacher"));
        setPeriods(ps);
        setEverySlot(slots);
        setClassId((prev) => prev ?? cs[0]?.id ?? null);
      })
      .finally(() => !cancelled && setDataLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, version]);

  const cls = classes.find((c) => c.id === classId) ?? null;
  const level = useMemo(() => grades.find((g) => g.id === cls?.grade_level_id)?.level_group ?? "other", [grades, cls]);
  const day = useMemo(() => periods.filter((p) => p.level_group === level).sort((a, b) => a.position - b.position), [periods, level]);
  const mine = everySlot.filter((s) => s.class_id === classId);
  const fits = (s: Subject) => !(s.grade_level_ids?.length) || (cls?.grade_level_id != null && s.grade_level_ids.includes(cls.grade_level_id));

  async function remove(slot: TimetableSlot) {
    if (!token || !schoolId) return;
    try {
      await api.deleteTimetableSlot(token, schoolId, slot.id);
      setEverySlot((all) => all.filter((x) => x.id !== slot.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't remove that lesson.");
    }
  }

  function busyTeachers(period: SchoolPeriod, d: number) {
    const out = new Map<number, string>();
    for (const s of everySlot) {
      if (s.day_of_week === d && s.teacher_user_id && s.start_time < period.end_time && s.end_time > period.start_time) out.set(s.teacher_user_id, s.class_name);
    }
    return out;
  }

  if (loading || dataLoading) return <PageLoader />;
  const lessonsCount = day.filter((p) => TEACHABLE.includes(p.kind)).length;
  const filled = mine.length;
  const capacity = day.filter((p) => TEACHABLE.includes(p.kind)).reduce((n, p) => n + p.days.filter((d) => d < 5).length, 0);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Timetable" subtitle="The school day is set once for each level. Teachers and subjects are then placed into its lesson blocks, and nothing can clash." />
      {schoolId && <PendingApprovals kind="bell_schedule" schoolId={schoolId} onDecided={() => setVersion((v) => v + 1)} />}

      {tab === "day" ? (
        schoolId && <SchoolDayEditor schoolId={schoolId} periods={periods} onSaved={() => setVersion((v) => v + 1)} />
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-14 text-center text-sm text-muted-foreground">Add a class first.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
              <SelectTrigger className="h-10 w-56"><SelectValue placeholder="Choose a class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {day.length > 0 && <span className="text-sm text-muted-foreground">{filled} of {capacity} lessons placed · {lessonsCount} teaching blocks a day</span>}
          </div>

          {day.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card px-5 py-8">
              <p className="font-medium">The school day has not been set for this level yet.</p>
              <p className="text-sm text-muted-foreground">Set the lesson, break, lunch and prep times once, and every class at this level uses them.</p>
              <Button onClick={() => setTab("day")}>Set the school day</Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <div className="min-w-[46rem]">
                <div className="grid grid-cols-[6.5rem_repeat(5,minmax(0,1fr))] border-b bg-muted/50 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <span className="px-3 py-2.5">Time</span>
                  {DAYS.map((d) => <span key={d} className="px-3 py-2.5">{d}</span>)}
                </div>
                {day.map((p) => {
                  const teachable = TEACHABLE.includes(p.kind);
                  return (
                    <div key={p.id} className={`grid grid-cols-[6.5rem_repeat(5,minmax(0,1fr))] border-b last:border-b-0 ${teachable ? "" : "bg-muted/30"}`}>
                      <div className="px-3 py-2.5 text-xs">
                        <span className="block font-medium tabular-nums">{hhmm(p.start_time)}–{hhmm(p.end_time)}</span>
                        <span className="block text-muted-foreground">{p.name}</span>
                      </div>
                      {teachable ? (
                        DAYS.map((_, d) => {
                          const slot = mine.find((s) => s.period_id === p.id && s.day_of_week === d);
                          if (!p.days.includes(d)) return <div key={d} className="border-l bg-muted/20" aria-hidden />;
                          return (
                            <div key={d} className="border-l p-1.5">
                              {slot ? (
                                <div className={`group flex h-full min-h-14 flex-col justify-between rounded-md border-l-4 px-2 py-1.5 ${SUBJECT_COLORS[slot.subject_id % SUBJECT_COLORS.length]}`}>
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="text-sm leading-tight font-semibold break-words">{slot.subject_name}</span>
                                    <button type="button" onClick={() => remove(slot)} aria-label={`Remove ${slot.subject_name}`} className="text-muted-foreground opacity-60 hover:text-destructive hover:opacity-100 focus-visible:opacity-100"><Trash2 className="size-3.5" /></button>
                                  </div>
                                  <span className="text-xs break-words text-muted-foreground">{slot.teacher_name ?? "No teacher yet"}</span>
                                </div>
                              ) : (
                                <button type="button" onClick={() => setPlacing({ period: p, day: d })} aria-label={`Add a lesson on ${DAYS[d]}, ${p.name}`} className="flex h-full min-h-14 w-full items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><Plus className="size-4" /></button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-5 flex items-center justify-center gap-2 border-l px-3 py-2.5 text-sm text-muted-foreground">
                          {p.kind === "lunch" ? <Utensils className="size-4" aria-hidden /> : <Coffee className="size-4" aria-hidden />}
                          {p.name} <Pill tone="muted">{KIND_LABEL[p.kind]}</Pill>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {placing && cls && (
        <PlaceDialog
          cls={cls}
          period={placing.period}
          day={placing.day}
          subjects={subjects.filter(fits)}
          teachers={teachers}
          busy={busyTeachers(placing.period, placing.day)}
          onClose={() => setPlacing(null)}
          onCreated={(slot) => {
            setEverySlot((all) => [...all, slot]);
            setPlacing(null);
          }}
        />
      )}
    </div>
  );
}
