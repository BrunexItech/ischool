"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  EllipsisVertical,
  Eye,
  FileText,
  FileUp,
  List,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError, GradeLevel, HomeworkGrid, HomeworkListItem, MyClass, SchoolClass, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { localDateStr } from "@/lib/dates";
import { PageLoader, Spinner } from "@/components/Spinner";
import { StatTile } from "@/components/StatTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const HOMEWORK_TYPES = ["Assignment", "Project", "Classwork", "Revision", "Reading", "Other"];
const PAGE_SIZE = 8;

type HwStatus = "pending" | "overdue" | "to_mark" | "completed";
type DuePreset = "all" | "week" | "next7" | "past" | "month";

const STATUS_STYLE: Record<HwStatus, { label: string; pill: string; chip: string; dot: string }> = {
  pending: {
    label: "Pending",
    dot: "bg-amber-400",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    chip: "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200",
  },
  overdue: {
    label: "Overdue",
    dot: "bg-red-400",
    pill: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    chip: "bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-950 dark:text-red-200",
  },
  to_mark: {
    label: "To mark",
    dot: "bg-violet-400",
    pill: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    chip: "bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-200",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    chip: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200",
  },
};

const DUE_PRESETS: Record<DuePreset, string> = {
  all: "Any due date",
  week: "Due this week",
  next7: "Due in the next 7 days",
  past: "Past due date",
  month: "Due this month",
};

const TYPE_TONES = [
  { tile: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", pill: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" },
  { tile: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300", pill: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200" },
  { tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", pill: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  { tile: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", pill: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  { tile: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300", pill: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200" },
  { tile: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300", pill: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200" },
];

function typeTone(type: string) {
  const known = HOMEWORK_TYPES.indexOf(type);
  if (known >= 0) return TYPE_TONES[known % TYPE_TONES.length];
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  return TYPE_TONES[hash % TYPE_TONES.length];
}

function addDaysStr(d: string, n: number) {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return localDateStr(x);
}

function mondayOfStr(d: string) {
  const wd = new Date(`${d}T12:00:00`).getDay();
  return addDaysStr(d, wd === 0 ? -6 : 1 - wd);
}

function matchesDue(preset: DuePreset, due: string, today: string) {
  switch (preset) {
    case "week": {
      const monday = mondayOfStr(today);
      return due >= monday && due <= addDaysStr(monday, 6);
    }
    case "next7":
      return due >= today && due <= addDaysStr(today, 7);
    case "past":
      return due < today;
    case "month":
      return due.slice(0, 7) === today.slice(0, 7);
    default:
      return true;
  }
}

function formatDue(due: string) {
  const d = new Date(`${due}T12:00:00`);
  return {
    date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    weekday: d.toLocaleDateString("en-GB", { weekday: "long" }),
  };
}

interface Row {
  hw: HomeworkListItem;
  status: HwStatus;
  missing: number;
  unmarked: number;
  pct: number;
  className: string;
  gradeName: string | null;
  subjectName: string;
}

function StatusPill({ status }: { status: HwStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.pill}`}>{s.label}</span>;
}

function TypePill({ type }: { type: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeTone(type).pill}`}>{type}</span>;
}

function TypeTile({ type }: { type: string }) {
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${typeTone(type).tile}`}>
      <FileText className="size-5" />
    </span>
  );
}

function SubmissionBar({ row, showToMark }: { row: Row; showToMark: boolean }) {
  const { hw, pct, unmarked } = row;
  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium tabular-nums">
          {hw.submitted_count} / {hw.total_students}
        </span>
        <span className="text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${hw.submitted_count} of ${hw.total_students} handed in`}
      >
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      {showToMark && unmarked > 0 && <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{unmarked} to mark</span>}
    </div>
  );
}

function RowMenu({
  row,
  canRecord,
  isAdmin,
  onView,
  onRemind,
  onDelete,
}: {
  row: Row;
  canRecord: boolean;
  isAdmin: boolean;
  onView: () => void;
  onRemind: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`More actions for ${row.hw.title}`} className="size-10 sm:size-9">
            <EllipsisVertical />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onView}>
          <Eye /> Review submissions
        </DropdownMenuItem>
        {canRecord && row.missing > 0 && (
          <DropdownMenuItem onClick={onRemind}>
            <BellRing /> Send reminder
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 /> Delete homework
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateHomeworkDialog({
  open,
  onOpenChange,
  classOptions,
  subjectsFor,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classOptions: { id: number; name: string }[];
  subjectsFor: (classId: number | null) => { id: number; name: string }[];
  onCreated: (item: HomeworkListItem | null) => void;
}) {
  const { user, token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"typed" | "board" | "none">("typed");
  const [form, setForm] = useState({ classId: "", subjectId: "", title: "", type: "Assignment", customType: "", instructions: "", dueDate: "", allowDigital: true });

  const subjectOptions = subjectsFor(form.classId ? Number(form.classId) : null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.classId || !form.subjectId) return;
    if (mode === "none") {
      setSubmitting(true);
      try {
        await api.declareNoHomework(token, user.school_id, Number(form.classId), Number(form.subjectId));
        toast.success("Recorded: no homework today");
        onOpenChange(false);
        onCreated(null);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not record that");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const board = mode === "board";
    const due = form.dueDate || (board ? addDaysStr(localDateStr(), 1) : "");
    if (!form.title || !due) return;
    setSubmitting(true);
    try {
      let created = await api.createHomework(token, user.school_id, {
        class_id: Number(form.classId),
        subject_id: Number(form.subjectId),
        title: form.title,
        homework_type: board ? "Assignment" : form.type === "Other" ? form.customType.trim() || "Other" : form.type,
        instructions: form.instructions || undefined,
        due_date: due,
        allow_digital_submission: board ? false : form.allowDigital,
        given_on_board: board,
      });
      if (file && !board) created = await api.uploadHomeworkAttachment(token, user.school_id, created.id, file);
      onCreated(created);
      setForm({ classId: "", subjectId: "", title: "", type: "Assignment", customType: "", instructions: "", dueDate: "", allowDigital: true });
      setFile(null);
      onOpenChange(false);
      toast.success(board ? "Recorded: homework given on the board" : "Homework created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create homework");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record homework</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="What happened" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {([["typed", "Typed in"], ["board", "On the board"], ["none", "None today"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`min-h-10 rounded-md px-1 text-sm font-medium transition-colors ${mode === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
            ))}
          </div>
          {mode === "board" && <p className="-mt-1 text-xs text-muted-foreground">Use this when you wrote the homework on the board or said it in class. It is recorded so school leadership can see it was given, even though it is not typed in as a full assignment.</p>}
          {mode === "none" && <p className="-mt-1 text-xs text-muted-foreground">Records that this class had no homework in this subject today, so the day is not mistaken for one that was missed.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select required value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v, subjectId: "" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Select required value={form.subjectId} onValueChange={(v) => v && setForm((f) => ({ ...f, subjectId: v }))} disabled={!form.classId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={form.classId ? "Select subject" : "Choose a class first"} />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === "typed" && <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOMEWORK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
            {mode !== "none" && <div className="grid gap-1.5">
              <Label>{mode === "board" ? "Due date (optional)" : "Due date"}</Label>
              <Input required={mode === "typed"} type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>}
            {mode === "typed" && form.type === "Other" && (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Custom type</Label>
                <Input placeholder="e.g. Science fair" value={form.customType} onChange={(e) => setForm((f) => ({ ...f, customType: e.target.value }))} />
              </div>
            )}
          </div>
          {mode !== "none" && (
          <div className="grid gap-1.5">
            <Label>{mode === "board" ? "What was given" : "Title"}</Label>
            <Input required placeholder={mode === "board" ? "e.g. Page 52, questions 1 to 5" : "e.g. Read chapter 3 and answer the questions"} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          )}
          {mode !== "none" && (
          <div className="grid gap-1.5">
            <Label>Instructions (optional)</Label>
            <Textarea rows={mode === "board" ? 2 : 3} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
          </div>
          )}
          {mode === "typed" && (<>
          <div className="grid gap-1.5">
            <Label>Worksheet (optional): PDF or photo</Label>
            {file ? (
              <div className="flex w-fit items-center gap-2 rounded-lg border p-2 pl-3 text-sm">
                <FileUp className="size-4 text-muted-foreground" />
                <span className="max-w-56 truncate">{file.name}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove file" onClick={() => setFile(null)}>
                  <X />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring">
                <FileUp className="size-5 shrink-0" />
                <span>Choose a PDF or photo</span>
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
          <div className="flex items-start gap-3">
            <Switch checked={form.allowDigital} onCheckedChange={(v) => setForm((f) => ({ ...f, allowDigital: v }))} />
            <Label className="font-normal">Allow learners to submit a photo online. Otherwise it is checked in the exercise book at school.</Label>
          </div>
          </>)}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : mode === "none" ? "Record: none today" : mode === "board" ? "Record homework" : "Create homework"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HomeworkCalendar({ rows, today }: { rows: Row[]; today: string }) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [year, monthNum] = month.split("-").map(Number);
  const first = new Date(year, monthNum - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;

  const byDate: Record<string, Row[]> = {};
  for (const r of rows) (byDate[r.hw.due_date] ??= []).push(r);

  function shift(delta: number) {
    const d = new Date(year, monthNum - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h3>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => shift(-1)} className="size-10 sm:size-9">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(today.slice(0, 7))} className="h-10 sm:h-9">
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => shift(1)} className="size-10 sm:size-9">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[44rem] grid-cols-7 overflow-hidden rounded-lg border">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-b bg-muted/50 p-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {d}
            </div>
          ))}
          {Array.from({ length: cellCount }, (_, i) => {
            const day = i - offset + 1;
            const inMonth = day >= 1 && day <= daysInMonth;
            const dateStr = inMonth ? `${month}-${String(day).padStart(2, "0")}` : "";
            const items = inMonth ? byDate[dateStr] ?? [] : [];
            const isToday = dateStr === today;
            return (
              <div key={i} className={`min-h-24 border-r border-b p-1.5 last:border-r-0 ${inMonth ? "" : "bg-muted/20"} ${i % 7 === 6 ? "border-r-0" : ""}`}>
                {inMonth && (
                  <>
                    <span
                      className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
                        isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="flex flex-col gap-1">
                      {items.slice(0, 3).map((r) => (
                        <Link
                          key={r.hw.id}
                          href={`/dashboard/homework/${r.hw.id}`}
                          title={`${r.hw.title} · ${r.className} · ${r.subjectName}`}
                          className={`truncate rounded px-1.5 py-0.5 text-[0.7rem] font-medium ${STATUS_STYLE[r.status].chip}`}
                        >
                          {r.hw.title}
                        </Link>
                      ))}
                      {items.length > 3 && <span className="px-1.5 text-[0.7rem] text-muted-foreground">+{items.length - 3} more</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(STATUS_STYLE) as HwStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${STATUS_STYLE[s].dot}`} /> {STATUS_STYLE[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}

function HomeworkListView() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isTeacher = user?.role === "teacher";
  const canRecord = user?.role === "super_admin" || user?.role === "teacher" || user?.role === "staff";
  const isAdmin = user?.role === "super_admin" || user?.role === "head_of_institution" || user?.role === "group_principal";

  const [items, setItems] = useState<HomeworkListItem[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [failed, setFailed] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [today] = useState(() => localDateStr());

  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | HwStatus>("all");
  const [dueFilter, setDueFilter] = useState<DuePreset>("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    let homeworkFailed = false;
    Promise.all([
      api.listHomework(token, schoolId).catch(() => {
        homeworkFailed = true;
        return [] as HomeworkListItem[];
      }),
      api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
      api.listSubjects(token, schoolId).catch(() => [] as Subject[]),
      api.listGradeLevels(token).catch(() => [] as GradeLevel[]),
      isTeacher ? api.listMyClasses(token, schoolId).catch(() => [] as MyClass[]) : Promise.resolve([] as MyClass[]),
    ]).then(([hw, cs, ss, gl, mc]) => {
      if (cancelled) return;
      setItems(hw);
      setClasses(cs);
      setSubjects(ss);
      setGrades(gl);
      setMyClasses(mc);
      setFailed(homeworkFailed);
      setDataLoading(false);
      setRetrying(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, reloadKey]);

  function retry() {
    setRetrying(true);
    setReloadKey((k) => k + 1);
  }

  const rows = useMemo<Row[]>(() => {
    const classById: Record<number, SchoolClass> = {};
    for (const c of classes) classById[c.id] = c;
    const gradeById: Record<number, string> = {};
    for (const g of grades) gradeById[g.id] = g.display_name;
    const subjectById: Record<number, string> = {};
    for (const s of subjects) subjectById[s.id] = s.name;
    const myClassName: Record<number, string> = {};
    for (const c of myClasses) myClassName[c.class_id] = c.class_name;
    const taught = new Set(myClasses.flatMap((c) => c.subjects.map((s) => `${c.class_id}:${s.subject_id}`)));

    return items
      .filter((hw) => !isTeacher || taught.has(`${hw.class_id}:${hw.subject_id}`))
      .map((hw) => {
        const missing = Math.max(0, hw.total_students - hw.submitted_count);
        const unmarked = Math.max(0, hw.submitted_count - hw.reviewed_count);
        const allIn = hw.total_students > 0 && missing === 0;
        // "Completed" means handed in AND marked; handed in but unmarked is still the teacher's to do.
        const status: HwStatus = allIn ? (unmarked > 0 ? "to_mark" : "completed") : hw.due_date < today ? "overdue" : "pending";
        const sc = classById[hw.class_id];
        return {
          hw,
          status,
          missing,
          unmarked,
          pct: hw.total_students > 0 ? Math.round((hw.submitted_count / hw.total_students) * 100) : 0,
          className: sc?.name ?? myClassName[hw.class_id] ?? "Class",
          gradeName: sc?.grade_level_id != null ? gradeById[sc.grade_level_id] ?? null : null,
          subjectName: subjectById[hw.subject_id] ?? "Subject",
        };
      });
  }, [items, classes, subjects, grades, myClasses, isTeacher, today]);

  if (loading || dataLoading) return <PageLoader />;

  const totals = {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    overdue: rows.filter((r) => r.status === "overdue").length,
    submitted: rows.reduce((sum, r) => sum + r.hw.submitted_count, 0),
  };

  const classChoices = Array.from(new Map(rows.map((r) => [r.hw.class_id, r.className])).entries());
  const subjectChoices = Array.from(new Map(rows.map((r) => [r.hw.subject_id, r.subjectName])).entries());
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (classFilter !== "all" && String(r.hw.class_id) !== classFilter) return false;
    if (subjectFilter !== "all" && String(r.hw.subject_id) !== subjectFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!matchesDue(dueFilter, r.hw.due_date, today)) return false;
    if (!q) return true;
    return [r.hw.title, r.className, r.subjectName, r.hw.homework_type].some((v) => v.toLowerCase().includes(q));
  });
  const filtersActive = classFilter !== "all" || subjectFilter !== "all" || statusFilter !== "all" || dueFilter !== "all" || q !== "";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const from = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(from, from + PAGE_SIZE);

  function resetFilters() {
    setClassFilter("all");
    setSubjectFilter("all");
    setStatusFilter("all");
    setDueFilter("all");
    setSearch("");
    setPage(1);
  }

  function pickStatus(s: "all" | HwStatus) {
    if (s === "all") return resetFilters();
    setStatusFilter(statusFilter === s ? "all" : s);
    setPage(1);
  }

  const classOptions = isTeacher
    ? myClasses.filter((c) => c.subjects.length > 0).map((c) => ({ id: c.class_id, name: c.class_name }))
    : classes.map((c) => ({ id: c.id, name: c.name }));
  const subjectsFor = (classId: number | null) => {
    if (!isTeacher) return subjects.map((s) => ({ id: s.id, name: s.name }));
    return (myClasses.find((c) => c.class_id === classId)?.subjects ?? []).map((s) => ({ id: s.subject_id, name: s.subject_name }));
  };

  async function remind(row: Row) {
    if (!token || !schoolId) return;
    try {
      const result = await api.remindHomework(token, schoolId, row.hw.id);
      if (result.reminded > 0) toast.success(`Reminder sent for ${result.reminded} learner${result.reminded === 1 ? "" : "s"}`);
      else toast.info("Everyone has already handed this in");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send reminder");
    }
  }

  async function confirmDelete() {
    if (!token || !schoolId || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteHomework(token, schoolId, deleteTarget.hw.id);
      setItems((all) => all.filter((h) => h.id !== deleteTarget.hw.id));
      toast.success("Homework deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete homework");
    } finally {
      setDeleting(false);
    }
  }

  const menuFor = (row: Row) => (
    <RowMenu
      row={row}
      canRecord={canRecord}
      isAdmin={isAdmin}
      onView={() => router.push(`/dashboard/homework/${row.hw.id}`)}
      onRemind={() => remind(row)}
      onDelete={() => setDeleteTarget(row)}
    />
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#6e1316] px-5 py-4 text-primary-foreground shadow-sm sm:px-6 sm:py-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-sidebar-primary" aria-hidden />
        <FileText className="pointer-events-none absolute -right-4 -bottom-8 size-32 text-white/10" strokeWidth={1} aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 sm:size-14">
              <FileText className="size-6 sm:size-7" />
            </span>
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Homework</h1>
              <p className="text-sm text-primary-foreground/80">
                {canRecord ? "Create, assign and manage homework for your classes." : "See the homework teachers have set across the school."}
              </p>
            </div>
          </div>
          {canRecord && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-10 justify-center bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:h-9 sm:shrink-0"
            >
              <Plus /> Create homework
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile
          icon={ClipboardList}
          tone="rose"
          label="Total Homework"
          value={failed ? "—" : totals.total}
          sub={isTeacher ? "Across your classes" : "Across the school"}
          onClick={() => pickStatus("all")}
          active={!filtersActive}
        />
        <StatTile
          icon={Clock}
          tone="sky"
          label="Pending"
          value={failed ? "—" : totals.pending}
          sub="Awaiting submissions"
          onClick={() => pickStatus("pending")}
          active={statusFilter === "pending"}
        />
        <StatTile icon={CheckCircle2} tone="emerald" label="Submitted" value={failed ? "—" : totals.submitted} sub="Handed in by learners" />
        <StatTile
          icon={CalendarClock}
          tone="amber"
          label="Overdue"
          value={failed ? "—" : totals.overdue}
          sub="Past due date"
          onClick={() => pickStatus("overdue")}
          active={statusFilter === "overdue"}
        />
      </div>

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50/50 px-4 py-10 text-center dark:border-red-900/50 dark:bg-red-950/10">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the homework list.</p>
          <Button size="sm" variant="outline" onClick={retry} disabled={retrying}>
            <RotateCw className={retrying ? "animate-spin" : ""} /> Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No homework yet</p>
          <p className="text-xs text-muted-foreground">
            {canRecord ? "Create your first homework and it will appear here." : "Homework that teachers set will appear here."}
          </p>
          {canRecord && (
            <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
              <Plus /> Create homework
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-[1fr_1fr_1fr_1.2fr_1.6fr]">
            <Select value={classFilter} onValueChange={(v) => { if (v) { setClassFilter(v); setPage(1); } }}>
              <SelectTrigger className="h-10 w-full bg-card" aria-label="Filter by class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classChoices.map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={(v) => { if (v) { setSubjectFilter(v); setPage(1); } }}>
              <SelectTrigger className="h-10 w-full bg-card" aria-label="Filter by subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjectChoices.map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { if (v) { setStatusFilter(v as "all" | HwStatus); setPage(1); } }}>
              <SelectTrigger className="h-10 w-full bg-card" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="to_mark">To mark</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dueFilter} onValueChange={(v) => { if (v) { setDueFilter(v as DuePreset); setPage(1); } }}>
              <SelectTrigger className="h-10 w-full bg-card" aria-label="Filter by due date">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DUE_PRESETS) as DuePreset[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {DUE_PRESETS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search homework..."
                aria-label="Search homework"
                className="h-10 bg-card pl-8"
              />
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
              <h2 className="font-heading text-lg font-semibold">Homework assignments</h2>
              <div className="flex overflow-hidden rounded-lg border" role="group" aria-label="Layout">
                {(
                  [
                    { key: "list", icon: List, label: "List view" },
                    { key: "calendar", icon: CalendarDays, label: "Calendar view" },
                  ] as const
                ).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={mode === key}
                    onClick={() => setMode(key)}
                    className={`flex h-10 items-center gap-2 px-3.5 text-sm font-medium transition-colors sm:h-9 ${
                      mode === key ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "calendar" ? (
              <HomeworkCalendar rows={filtered} today={today} />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <p className="text-sm font-medium">No homework matches your filters</p>
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                <div className="hidden xl:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-5">Title</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Due date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submissions</TableHead>
                        <TableHead className="pr-5 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((r) => {
                        const due = formatDue(r.hw.due_date);
                        return (
                          <TableRow key={r.hw.id}>
                            <TableCell className="max-w-72 pl-5">
                              <div className="flex items-center gap-3">
                                <TypeTile type={r.hw.homework_type} />
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1.5 font-medium">
                                    <span className="truncate">{r.hw.title}</span>
                                    {r.hw.attachment_url && <FileUp className="size-3.5 shrink-0 text-muted-foreground" aria-label="Has a worksheet attached" />}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">{r.hw.instructions || "No instructions added"}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{r.className}</p>
                              {r.gradeName && <p className="text-xs text-muted-foreground">{r.gradeName}</p>}
                            </TableCell>
                            <TableCell className="text-sm">{r.subjectName}</TableCell>
                            <TableCell>
                              <TypePill type={r.hw.homework_type} />{r.hw.given_on_board && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">On the board</span>}
                            </TableCell>
                            <TableCell>
                              <p className={`text-sm font-medium tabular-nums ${r.status === "overdue" ? "text-red-700 dark:text-red-400" : ""}`}>{due.date}</p>
                              <p className="text-xs text-muted-foreground">{due.weekday}</p>
                            </TableCell>
                            <TableCell>
                              <StatusPill status={r.status} />
                            </TableCell>
                            <TableCell>
                              <SubmissionBar row={r} showToMark={canRecord} />
                            </TableCell>
                            <TableCell className="pr-5">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/homework/${r.hw.id}`}><Eye /> View</Link>} />
                                {menuFor(r)}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <ul className="flex flex-col divide-y xl:hidden">
                  {visible.map((r) => {
                    const due = formatDue(r.hw.due_date);
                    return (
                      <li key={r.hw.id} className="flex flex-col gap-3 p-4">
                        <div className="flex items-start gap-3">
                          <TypeTile type={r.hw.homework_type} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{r.hw.title}</p>
                            <p className="line-clamp-1 text-xs text-muted-foreground">{r.hw.instructions || "No instructions added"}</p>
                          </div>
                          <StatusPill status={r.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{r.className}</span>
                          <span>{r.subjectName}</span>
                          <TypePill type={r.hw.homework_type} />{r.hw.given_on_board && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">On the board</span>}
                          <span className={r.status === "overdue" ? "font-medium text-red-700 dark:text-red-400" : ""}>
                            Due {due.date} ({due.weekday})
                          </span>
                        </div>
                        <SubmissionBar row={r} showToMark={canRecord} />
                        <div className="flex items-center gap-2">
                          <Button className="h-10 flex-1" variant="outline" nativeButton={false} render={<Link href={`/dashboard/homework/${r.hw.id}`}><Eye /> View submissions</Link>} />
                          {menuFor(r)}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
                  <p className="text-sm text-muted-foreground">
                    {totalPages === 1
                      ? `Showing ${filtered.length} of ${filtered.length} homework`
                      : `Showing ${from + 1}–${from + visible.length} of ${filtered.length} homework`}
                  </p>
                  {totalPages > 1 && (
                    <nav aria-label="Pagination" className="flex items-center gap-1.5">
                      <Button variant="outline" size="icon" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="size-10 sm:size-9">
                        <ChevronLeft />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <Button
                          key={n}
                          variant={n === currentPage ? "default" : "outline"}
                          size="icon"
                          aria-label={`Page ${n}`}
                          aria-current={n === currentPage ? "page" : undefined}
                          onClick={() => setPage(n)}
                          className="size-10 sm:size-9"
                        >
                          {n}
                        </Button>
                      ))}
                      <Button variant="outline" size="icon" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="size-10 sm:size-9">
                        <ChevronRight />
                      </Button>
                    </nav>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {canRecord && (
        <CreateHomeworkDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          classOptions={classOptions}
          subjectsFor={subjectsFor}
          onCreated={(item) => (item ? setItems((all) => [item, ...all]) : setReloadKey((k) => k + 1))}
        />
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this homework?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &ldquo;{deleteTarget?.hw.title}&rdquo; and every learner submission for it will be permanently removed. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Spinner size={16} className="text-current" />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


const CELL: Record<string, { label: string; cls: string }> = {
  given: { label: "Typed", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  board: { label: "Board", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  none: { label: "None", cls: "bg-muted text-muted-foreground" },
  missing: { label: "Not recorded", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  upcoming: { label: "", cls: "border border-dashed text-muted-foreground" },
  no_lesson: { label: "", cls: "" },
};

function HomeworkWeek() {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [week, setWeek] = useState<string | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<{ key: string; grid: HomeworkGrid | null } | null>(null);
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const key = `${week ?? "now"}/${reloadKey}`;

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.getHomeworkGrid(token, schoolId, week).then((grid) => !cancelled && setData({ key, grid })).catch(() => !cancelled && setData({ key, grid: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, week, key]);

  const ready = data && data.key === key;
  const grid = ready ? data.grid : null;
  const q = search.trim().toLowerCase();
  const rows = (grid?.rows ?? []).filter((r) => (!q || `${r.class_name} ${r.subject} ${r.teacher ?? ""}`.toLowerCase().includes(q)) && (!onlyMissing || r.cells.some((c) => c.status === "missing")));
  const dayName = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
  const recorded = grid ? grid.summary.given + grid.summary.board + grid.summary.none : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="icon" className="size-10" aria-label="Previous week" onClick={() => grid && setWeek(addDaysStr(grid.week_start, -7))}><ChevronLeft /></Button>
        <p className="min-w-44 text-center text-sm font-medium">{grid ? `Week of ${new Date(grid.week_start + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : "Loading..."}</p>
        <Button variant="outline" size="icon" className="size-10" aria-label="Next week" disabled={!grid || addDaysStr(grid.week_start, 7) > localDateStr()} onClick={() => grid && setWeek(addDaysStr(grid.week_start, 7))}><ChevronRight /></Button>
        {week && <Button variant="ghost" className="h-10" onClick={() => setWeek(undefined)}>This week</Button>}
      </div>

      {!ready ? (
        <PageLoader />
      ) : !grid ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the homework overview.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
        </div>
      ) : grid.rows.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">There are no timetabled lessons or subject allocations yet, so there is nothing to track.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Week summary">
            {[
              ["Lessons with homework recorded", `${recorded} of ${grid.summary.expected}`, "typed, on the board or none"],
              ["Typed in", String(grid.summary.given), "full assignments"],
              ["Given on the board", String(grid.summary.board), "written or said in class"],
              ["No homework", String(grid.summary.none), "declared by the teacher"],
              ["Not recorded", String(grid.summary.missing), "nothing entered for the day"],
            ].map(([label, value, sub], i) => (
              <div key={label} className={`rounded-xl border bg-card p-3.5 sm:p-4 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`font-heading text-2xl font-semibold tabular-nums ${label === "Not recorded" && Number(value) > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search class, subject or teacher..." aria-label="Search" className="h-10 pl-8" />
            </div>
            <button type="button" aria-pressed={onlyMissing} onClick={() => setOnlyMissing((v) => !v)} className={`h-10 w-fit rounded-full border px-4 text-sm font-medium transition-colors ${onlyMissing ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>Only rows with gaps</button>
          </div>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] gap-2 border-b bg-muted/50 px-5 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
              <span>Class and subject</span>
              {grid.days.map((d) => <span key={d} className="text-center">{dayName(d)}</span>)}
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">Nothing matches.</p>
            ) : (
              <ul className="divide-y">
                {rows.map((r) => (
                  <li key={`${r.class_id}-${r.subject_id}`} className="grid gap-2 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] md:items-center">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{r.subject} <span className="font-normal text-muted-foreground">· {r.class_name}</span></p>
                      <p className="text-xs text-muted-foreground">{r.teacher ?? "No teacher"}</p>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 md:contents">
                      {r.cells.map((c) => (
                        <div key={c.date} title={c.titles.join("; ") || undefined} className="flex flex-col items-stretch gap-1 md:items-center">
                          <span className="text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase md:hidden">{new Date(c.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}</span>
                          <span className={`flex min-h-9 items-center justify-center rounded-md px-1 text-center text-[11px] leading-tight font-semibold ${CELL[c.status].cls}`}>
                            {c.status === "no_lesson" ? <span className="text-muted-foreground/40">·</span> : c.status === "upcoming" ? "" : CELL[c.status].label}
                            {(c.status === "given" || c.status === "board") && c.count > 1 ? ` ×${c.count}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-xs text-muted-foreground">A day is only expected when the subject is on that class&apos;s timetable. &ldquo;Board&rdquo; means the teacher recorded homework written on the board or said aloud.</p>
        </>
      )}
    </div>
  );
}

export default function HomeworkPage() {
  const { user } = useAuth();
  const isHead = user?.role === "head_of_institution" || user?.role === "group_principal" || user?.role === "super_admin";
  const [choice, setChoice] = useState<"week" | "list" | null>(null);
  if (!isHead) return <HomeworkListView />;
  const view = choice ?? "week";
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Homework</h1>
        <p className="mt-1 text-sm text-muted-foreground">Whether homework is being given, class by class. Teachers record it; you can see it here.</p>
      </div>
      <div role="tablist" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {([["week", "This week"], ["list", "All homework"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setChoice(k)} className={`h-9 rounded-md px-4 text-sm font-medium transition-colors ${view === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>
      {view === "week" ? <HomeworkWeek /> : <HomeworkListView />}
    </div>
  );
}
