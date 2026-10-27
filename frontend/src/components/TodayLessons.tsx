"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Check, Clock, MapPin, RotateCw, Undo2 } from "lucide-react";
import { api, ApiError, DayLesson, DeliveryStatus, LessonDay, NotTaughtReason } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const REASONS: { key: NotTaughtReason; label: string }[] = [
  { key: "teacher_absent", label: "I was away" },
  { key: "public_holiday", label: "Public holiday" },
  { key: "exams", label: "Exams" },
  { key: "school_event", label: "School event" },
  { key: "other", label: "Other" },
];

const REASON_LABEL: Record<string, string> = Object.fromEntries(REASONS.map((r) => [r.key, r.label]));

const STATUS_TEXT: Record<DeliveryStatus, string> = { taught: "Taught", partly: "Partly taught", not_taught: "Not taught" };
const STATUS_PILL: Record<DeliveryStatus, string> = {
  taught: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  partly: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  not_taught: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function hhmm(t: string) {
  return t.slice(0, 5);
}

interface Loaded {
  today: LessonDay | null;
  earlier: LessonDay | null;
}

async function fetchDays(token: string, schoolId: number): Promise<{ data: Loaded; failed: boolean }> {
  const todayStr = localDateStr();
  let failed = false;
  const [today, earlier] = await Promise.all([
    api.getLessonDay(token, schoolId, todayStr).catch(() => {
      failed = true;
      return null;
    }),
    api.getLessonDay(token, schoolId, addDaysStr(todayStr, -1)).catch(() => null),
  ]);
  return { data: { today, earlier }, failed };
}

function MarkDialog({
  lesson,
  date,
  mode,
  onClose,
  onDone,
}: {
  lesson: DayLesson;
  date: string;
  mode: "partly" | "not_taught" | "remark";
  onClose: () => void;
  onDone: () => void;
}) {
  const { token, user } = useAuth();
  const current = lesson.delivery;
  const [reason, setReason] = useState<NotTaughtReason | "">((current?.reason as NotTaughtReason | null) ?? "");
  const [remark, setRemark] = useState(current?.remark ?? "");
  const [saving, setSaving] = useState(false);
  const status: DeliveryStatus = mode === "remark" ? (current?.status ?? "taught") : mode;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    if (status === "not_taught" && !reason) {
      toast.error("Choose why the lesson was not taught");
      return;
    }
    setSaving(true);
    try {
      await api.markLesson(token, user.school_id, {
        timetable_slot_id: lesson.slot_id,
        lesson_date: date,
        status,
        reason: status === "not_taught" ? (reason as NotTaughtReason) : undefined,
        remark: remark.trim() || undefined,
        entry_id: current?.entry_id ?? lesson.entry?.id,
      });
      toast.success(status === "not_taught" ? "Recorded as not taught" : status === "partly" ? "Recorded as partly taught" : "Remark saved");
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
      setSaving(false);
    }
  }

  const title = mode === "not_taught" ? "Why was it not taught?" : mode === "partly" ? "Partly taught" : "Remark for this lesson";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {lesson.subject_name} · {lesson.class_name} · {hhmm(lesson.start_time)}
          {lesson.entry ? ` · ${lesson.entry.topic}` : ""}
        </p>
        <form onSubmit={save} className="flex flex-col gap-4">
          {status === "not_taught" && (
            <div className="grid gap-2" role="radiogroup" aria-label="Reason">
              {REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={reason === r.key}
                  onClick={() => setReason(r.key)}
                  className={`flex h-11 items-center rounded-lg border px-3 text-left text-sm font-medium transition-colors ${reason === r.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>{status === "partly" ? "What is left to cover?" : status === "not_taught" ? "Remark (optional)" : "Remark (what was covered, how it went)"}</Label>
            <Textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={status === "partly" ? "e.g. Finished examples; exercise still to do" : "Optional"} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Spinner size={16} className="text-current" />} Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HomeworkQuick({ lesson, date, onClose }: { lesson: DayLesson; date: string; onClose: () => void }) {
  const { token, user } = useAuth();
  const [mode, setMode] = useState<"board" | "none">("board");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      if (mode === "none") {
        await api.declareNoHomework(token, user.school_id, lesson.class_id, lesson.subject_id);
        toast.success("Recorded: no homework today");
      } else {
        await api.createHomework(token, user.school_id, {
          class_id: lesson.class_id,
          subject_id: lesson.subject_id,
          title: text.trim(),
          homework_type: "Assignment",
          due_date: addDaysStr(date, 1),
          allow_digital_submission: false,
          given_on_board: true,
        });
        toast.success("Recorded: homework given on the board");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Homework for {lesson.subject_name}, {lesson.class_name}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Homework" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {([["board", "Given on the board"], ["none", "None today"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`min-h-10 rounded-md text-sm font-medium transition-colors ${mode === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
            ))}
          </div>
          {mode === "board" ? (
            <div className="grid gap-1.5">
              <Label>What was given</Label>
              <Textarea rows={2} required autoFocus placeholder="e.g. Page 52, questions 1 to 5" value={text} onChange={(e) => setText(e.target.value)} />
              <p className="text-xs text-muted-foreground">So school leadership can see homework was given, even though it is not typed in as a full assignment.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Records that this class had no homework in this subject today.</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <Link href="/dashboard/homework" className="text-sm font-medium text-primary hover:underline">Type a full assignment instead</Link>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || (mode === "board" && !text.trim())}>{saving && <Spinner size={16} className="text-current" />} Save</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LessonRow({
  lesson,
  date,
  compact,
  busy,
  onTaught,
  onOpen,
  onUndo,
  onHomework,
}: {
  lesson: DayLesson;
  date: string;
  compact: boolean;
  busy: boolean;
  onTaught: () => void;
  onOpen: (mode: "partly" | "not_taught" | "remark") => void;
  onUndo: () => void;
  onHomework: () => void;
}) {
  const d = lesson.delivery;
  const entry = lesson.entry;
  const planHref = lesson.plan ? `/dashboard/lesson-plans/${lesson.plan.plan_id}` : `/dashboard/lesson-plans?new=1&class=${lesson.class_id}&subject=${lesson.subject_id}`;
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex items-center gap-3 sm:w-36 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden /> {hhmm(lesson.start_time)}–{hhmm(lesson.end_time)}
          </p>
          {lesson.room && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden /> {lesson.room}
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-medium break-words">
            {lesson.subject_name} <span className="font-normal text-muted-foreground">· {lesson.class_name}</span>
          </p>
          {d ? (
            <div className="mt-1.5 flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_PILL[d.status]}`}>
                  {d.status === "taught" && <Check className="mr-1 size-3.5" aria-hidden />}
                  {STATUS_TEXT[d.status]}
                  {d.status === "not_taught" && d.reason ? `: ${REASON_LABEL[d.reason] ?? d.reason}` : ""}
                </span>
                {d.topic && <span className="text-sm break-words">{d.topic}</span>}
              </div>
              {d.remark && <p className="text-sm break-words text-muted-foreground">&ldquo;{d.remark}&rdquo;</p>}
            </div>
          ) : entry ? (
            <div className="mt-1 text-sm">
              <p className="break-words">
                <span className="text-muted-foreground">Planned: </span>
                <span className="font-medium">{entry.topic}</span>
                <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{entry.label}</span>
              </p>
              {!compact && entry.objectives && <p className="mt-1 break-words text-muted-foreground">Objectives: {entry.objectives}</p>}
              {!compact && entry.resources && <p className="break-words text-muted-foreground">Resources: {entry.resources}</p>}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {lesson.plan ? "Every topic in this plan is already covered. " : "Nothing planned for this lesson yet. "}
              <Link href={planHref} className="font-medium text-primary underline-offset-2 hover:underline">
                {lesson.plan ? "Open the plan" : "Plan it"}
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:pl-[10.25rem]">
        {d ? (
          <>
            <Button size="sm" variant="outline" className="h-10 sm:h-8" onClick={() => onOpen("remark")}>
              {d.remark ? "Edit remark" : "Add remark"}
            </Button>
            <Button size="sm" variant="ghost" className="h-10 sm:h-8" onClick={onUndo} disabled={busy}>
              <Undo2 /> Undo
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={onTaught} disabled={busy}>
              {busy ? <Spinner size={16} className="text-current" /> : <Check />} Taught
            </Button>
            <Button size="sm" variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={() => onOpen("partly")} disabled={busy}>
              Partly
            </Button>
            <Button size="sm" variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={() => onOpen("not_taught")} disabled={busy}>
              Not taught
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="h-10 sm:h-8" onClick={onHomework}>Homework</Button>
      </div>
      <span className="sr-only">{date}</span>
    </li>
  );
}

/** Today's timetabled lessons with what was planned for each, and one-tap
 * marking. Shared by the Lesson Plans page and the teacher Overview. */
export function TodayLessons({ compact = false }: { compact?: boolean }) {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ lesson: DayLesson; date: string; mode: "partly" | "not_taught" | "remark" } | null>(null);
  const [hwFor, setHwFor] = useState<{ lesson: DayLesson; date: string } | null>(null);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    fetchDays(token, schoolId).then(({ data: d, failed: f }) => {
      if (cancelled) return;
      setData(d);
      setFailed(f);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  async function markTaught(lesson: DayLesson, date: string) {
    if (!token || !schoolId) return;
    setBusySlot(lesson.slot_id);
    try {
      await api.markLesson(token, schoolId, { timetable_slot_id: lesson.slot_id, lesson_date: date, status: "taught", entry_id: lesson.entry?.id });
      toast.success(lesson.entry ? `${lesson.entry.topic} marked as taught` : "Lesson marked as taught");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setBusySlot(null);
    }
  }

  async function undo(lesson: DayLesson) {
    if (!token || !schoolId || !lesson.delivery) return;
    setBusySlot(lesson.slot_id);
    try {
      await api.undoLessonMark(token, schoolId, lesson.delivery.id);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not undo");
    } finally {
      setBusySlot(null);
    }
  }

  if (!data && !failed) {
    return (
      <section className="rounded-xl border bg-card p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-16 animate-pulse rounded bg-muted/60" />
      </section>
    );
  }

  const today = data?.today ?? null;
  const earlierUnmarked = (data?.earlier?.lessons ?? []).filter((l) => !l.delivery);
  const marked = today ? today.lessons.filter((l) => l.delivery).length : 0;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-heading text-lg font-semibold">Today&apos;s lessons</h2>
          {today && (
            <p className="text-sm text-muted-foreground">
              {today.lessons.length === 0 ? "No lessons on your timetable today" : `${marked} of ${today.lessons.length} marked`}
            </p>
          )}
        </div>
        {today && today.lessons.length > 0 && (
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={marked} aria-valuemin={0} aria-valuemax={today.lessons.length} aria-label="Lessons marked today">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(marked / today.lessons.length) * 100}%` }} />
          </div>
        )}
      </div>

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load your lessons.</p>
          <Button size="sm" variant="outline" onClick={reload}><RotateCw /> Try again</Button>
        </div>
      ) : (
        <>
          {today?.holiday && (
            <p className="border-b bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground sm:px-5">
              {today.holiday} is marked as a holiday on the school calendar. You can leave today&apos;s lessons unmarked.
            </p>
          )}
          {today && today.lessons.length > 0 && (
            <ul className="divide-y">
              {today.lessons.map((l) => (
                <LessonRow
                  key={l.slot_id}
                  lesson={l}
                  date={today.date}
                  compact={compact}
                  busy={busySlot === l.slot_id}
                  onTaught={() => markTaught(l, today.date)}
                  onOpen={(mode) => setDialog({ lesson: l, date: today.date, mode })}
                  onUndo={() => undo(l)}
                  onHomework={() => setHwFor({ lesson: l, date: today.date })}
                />
              ))}
            </ul>
          )}
          {today && today.lessons.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Enjoy the free day. Nothing to mark.</p>}

          {earlierUnmarked.length > 0 && data?.earlier && !data.earlier.holiday && (
            <div className="border-t">
              <p className="bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 sm:px-5">
                Yesterday: {earlierUnmarked.length} lesson{earlierUnmarked.length === 1 ? "" : "s"} not yet marked
              </p>
              <ul className="divide-y">
                {earlierUnmarked.map((l) => (
                  <LessonRow
                    key={l.slot_id}
                    lesson={l}
                    date={data.earlier!.date}
                    compact={compact}
                    busy={busySlot === l.slot_id}
                    onTaught={() => markTaught(l, data.earlier!.date)}
                    onOpen={(mode) => setDialog({ lesson: l, date: data.earlier!.date, mode })}
                    onUndo={() => undo(l)}
                    onHomework={() => setHwFor({ lesson: l, date: data.earlier!.date })}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {hwFor && <HomeworkQuick key={`${hwFor.lesson.slot_id}-${hwFor.date}`} lesson={hwFor.lesson} date={hwFor.date} onClose={() => setHwFor(null)} />}
      {dialog && <MarkDialog key={`${dialog.lesson.slot_id}-${dialog.date}-${dialog.mode}`} lesson={dialog.lesson} date={dialog.date} mode={dialog.mode} onClose={() => setDialog(null)} onDone={reload} />}
    </section>
  );
}
