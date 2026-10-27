"use client";

import { ModuleBanner } from "@/components/ModuleBanner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  EllipsisVertical,
  Eye,
  FilePlus,
  FileText,
  FileUp,
  ListChecks,
  Plus,
  RotateCw,
  Search,
  TextCursorInput,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError, Exam, ExamQuestionType, SchoolClass, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DepartmentPulse } from "@/components/DepartmentPulse";
import { ViewOnly } from "@/components/oversight";

const NO_CLASS = "all";
const EXAM_TYPES = ["Opener", "CAT 1", "CAT 2", "Mid Term", "End Term", "Mock", "Other"];
const PAGE_SIZE = 6;
const FILE_TYPES = "application/pdf,image/png,image/jpeg,image/webp";

type ExamStatus = "draft" | "scheduled" | "published" | "closed";

const STATUS_STYLE: Record<ExamStatus, { label: string; pill: string }> = {
  draft: { label: "Draft", pill: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  scheduled: { label: "Scheduled", pill: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  published: { label: "Published", pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  closed: { label: "Closed", pill: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
};

const TYPE_TONES = [
  { tile: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", pill: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" },
  { tile: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300", pill: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200" },
  { tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", pill: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  { tile: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", pill: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  { tile: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300", pill: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200" },
  { tile: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300", pill: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200" },
];

const ICON_TONES = {
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
} as const;

function typeTone(type: string) {
  const known = EXAM_TYPES.indexOf(type);
  if (known >= 0) return TYPE_TONES[known % TYPE_TONES.length];
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  return TYPE_TONES[hash % TYPE_TONES.length];
}

function statusOf(exam: Exam, now: Date): ExamStatus {
  if (!exam.is_published) return "draft";
  if (exam.opens_at && new Date(exam.opens_at) > now) return "scheduled";
  if (exam.closes_at && new Date(exam.closes_at) < now) return "closed";
  return "published";
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

interface DraftQuestion {
  question_text: string;
  question_type: ExamQuestionType;
  marks: string;
  options: string[];
  correct_option_index: number | null;
}

function emptyQuestion(): DraftQuestion {
  return { question_text: "", question_type: "mcq", marks: "5", options: ["", ""], correct_option_index: null };
}

interface Row {
  exam: Exam;
  status: ExamStatus;
  className: string;
  subjectName: string;
  isPaper: boolean;
  hasQuestions: boolean;
}

function StatusPill({ status }: { status: ExamStatus }) {
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

function FormatText({ row }: { row: Row }) {
  const { exam } = row;
  if (row.isPaper) return <span>Paper upload</span>;
  if (row.hasQuestions) {
    return (
      <span>
        Online · {exam.question_count} question{exam.question_count === 1 ? "" : "s"} · {exam.total_marks} marks
      </span>
    );
  }
  return <span>No questions or paper yet</span>;
}

function WindowText({ exam }: { exam: Exam }) {
  if (!exam.opens_at && !exam.closes_at) return <p className="text-sm text-muted-foreground">Anytime once published</p>;
  const opens = exam.opens_at ? formatDateTime(exam.opens_at) : null;
  const closes = exam.closes_at ? formatDateTime(exam.closes_at) : null;
  return (
    <>
      <p className="text-sm font-medium tabular-nums">{opens ? opens.date : `Until ${closes?.date}`}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {opens ? `${opens.time}${closes ? ` – ${closes.date === opens.date ? closes.time : `${closes.date}, ${closes.time}`}` : ""}` : closes?.time}
      </p>
    </>
  );
}

function ActionCard({
  icon: Icon,
  tone,
  title,
  description,
  onClick,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof ICON_TONES;
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <div className="flex h-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 sm:p-4">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-12 ${ICON_TONES[tone]}`}>
        <Icon className="size-5 sm:size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold sm:text-base">{title}</p>
        <p className="text-xs leading-snug text-muted-foreground sm:text-sm">{description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  );
  const focus = "block h-full w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return href ? (
    <Link href={href} className={focus}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={focus}>
      {body}
    </button>
  );
}

function ExamRowMenu({
  row,
  canRecord,
  isAdmin,
  busy,
  onTogglePublish,
  onUpload,
  onDelete,
}: {
  row: Row;
  canRecord: boolean;
  isAdmin: boolean;
  busy: boolean;
  onTogglePublish: () => void;
  onUpload: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const { exam } = row;
  const canViewDetail = row.hasQuestions;
  if (!canViewDetail && !row.isPaper && !canRecord && !isAdmin) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`More actions for ${exam.title}`} className="size-10 sm:size-9">
            <EllipsisVertical />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {canViewDetail && (
          <DropdownMenuItem onClick={() => router.push(`/dashboard/exams/${exam.id}`)}>
            <Eye /> View, submissions and print
          </DropdownMenuItem>
        )}
        {row.isPaper && exam.paper_file_url && (
          <DropdownMenuItem onClick={() => window.open(exam.paper_file_url ?? "", "_blank", "noopener")}>
            <FileText /> Open paper
          </DropdownMenuItem>
        )}
        {canRecord && (
          <DropdownMenuItem onClick={onTogglePublish} disabled={busy}>
            <ClipboardCheck /> {exam.is_published ? "Unpublish (back to draft)" : "Publish to learners"}
          </DropdownMenuItem>
        )}
        {canRecord && !row.isPaper && !row.hasQuestions && (
          <DropdownMenuItem onClick={onUpload} disabled={busy}>
            <Upload /> Upload paper
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 /> Delete exam
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateExamDialog({
  initialMode,
  classes,
  subjects,
  onClose,
  onCreated,
}: {
  initialMode: "questions" | "paper";
  classes: SchoolClass[];
  subjects: Subject[];
  onClose: () => void;
  onCreated: (exam: Exam) => void;
}) {
  const { user, token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"questions" | "paper">(initialMode);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [form, setForm] = useState({ subjectId: "", classId: NO_CLASS, title: "", examType: "CAT 1", customType: "", term: "", duration: "60", opensAt: "", closesAt: "" });

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(qIndex: number, optIndex: number, value: string) {
    setQuestions((qs) => qs.map((q, i) => (i === qIndex ? { ...q, options: q.options.map((o, oi) => (oi === optIndex ? value : o)) } : q)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.subjectId || !form.title || !form.term) return;

    if (mode === "questions") {
      for (const q of questions) {
        if (!q.question_text.trim()) {
          toast.error("Every question needs its text filled in");
          return;
        }
        if (q.question_type === "mcq" && (q.correct_option_index === null || q.options.some((o) => !o.trim()))) {
          toast.error("Every multiple-choice option needs text, and a correct answer must be selected");
          return;
        }
      }
    } else if (!paperFile) {
      toast.error("Choose a PDF or photo of the exam paper");
      return;
    }
    if (form.opensAt && form.closesAt && new Date(form.closesAt) <= new Date(form.opensAt)) {
      toast.error("The closing time must be after the opening time");
      return;
    }

    setSubmitting(true);
    let created: Exam;
    try {
      created = await api.createExam(token, user.school_id, {
        subject_id: Number(form.subjectId),
        class_id: form.classId === NO_CLASS ? undefined : Number(form.classId),
        title: form.title,
        exam_type: form.examType === "Other" ? form.customType.trim() || "Other" : form.examType,
        term: form.term,
        duration_minutes: mode === "questions" ? Number(form.duration) : undefined,
        opens_at: form.opensAt ? new Date(form.opensAt).toISOString() : undefined,
        closes_at: form.closesAt ? new Date(form.closesAt).toISOString() : undefined,
        questions:
          mode === "questions"
            ? questions.map((q, i) => ({
                question_text: q.question_text,
                question_type: q.question_type,
                marks: Number(q.marks),
                order: i + 1,
                options: q.question_type === "mcq" ? q.options : undefined,
                correct_option_index: q.question_type === "mcq" ? q.correct_option_index ?? undefined : undefined,
              }))
            : [],
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create exam");
      setSubmitting(false);
      return;
    }

    let finalExam: Exam = created;
    if (mode === "paper" && paperFile) {
      try {
        finalExam = await api.uploadExamPaper(token, user.school_id, created.id, paperFile);
      } catch (err) {
        toast.error(`${created.title} was created, but the paper could not be uploaded. Use "Upload paper" on the exam to try again. ${err instanceof ApiError ? err.message : ""}`);
      }
    }
    onCreated(finalExam);
    toast.success(`${finalExam.title} created`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create exam</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Title</Label>
              <Input required placeholder="e.g. Mathematics End of Term 2" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={form.examType} onValueChange={(v) => v && setForm((f) => ({ ...f, examType: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.examType === "Other" ? (
              <div className="grid gap-1.5">
                <Label>Custom type</Label>
                <Input placeholder="e.g. Mock 2" value={form.customType} onChange={(e) => setForm((f) => ({ ...f, customType: e.target.value }))} />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label>Term</Label>
                <Input required placeholder="e.g. Term 1 2026" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
              </div>
            )}
            {form.examType === "Other" && (
              <div className="grid gap-1.5">
                <Label>Term</Label>
                <Input required placeholder="e.g. Term 1 2026" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Select required value={form.subjectId} onValueChange={(v) => v && setForm((f) => ({ ...f, subjectId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLASS}>All classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === "questions" && (
              <div className="grid gap-1.5">
                <Label>Duration (minutes)</Label>
                <Input required type="number" min={1} value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Opens (optional)</Label>
              <Input type="datetime-local" value={form.opensAt} onChange={(e) => setForm((f) => ({ ...f, opensAt: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Closes (optional)</Label>
              <Input type="datetime-local" value={form.closesAt} onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>How will learners sit it?</Label>
            <div role="radiogroup" aria-label="Exam format" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { key: "questions", icon: ListChecks, title: "Online questions", text: "Learners answer on screen within a time limit." },
                  { key: "paper", icon: FileUp, title: "Paper upload", text: "Learners get a PDF or photo and sit it on paper. Record marks in Grading." },
                ] as const
              ).map(({ key, icon: Icon, title, text }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={mode === key}
                  onClick={() => setMode(key)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    mode === key ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent/50"
                  }`}
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${mode === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="size-4.5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-muted-foreground">{text}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {mode === "paper" ? (
            <div className="grid gap-1.5">
              <Label>Exam paper: PDF or photo</Label>
              {paperFile ? (
                <div className="flex w-fit items-center gap-2 rounded-lg border p-2 pl-3 text-sm">
                  <FileUp className="size-4 text-muted-foreground" />
                  <span className="max-w-64 truncate">{paperFile.name}</span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove file" onClick={() => setPaperFile(null)}>
                    <X />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring">
                  <FileUp className="size-5 shrink-0" />
                  <span>Choose a PDF or photo of the paper</span>
                  <input type="file" accept={FILE_TYPES} className="sr-only" onChange={(e) => setPaperFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              <p className="text-xs text-muted-foreground">Learners download this within the window above and sit it on paper. You record each score in Grading afterwards.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Question {i + 1}</p>
                    {questions.length > 1 && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  <Input required placeholder="Type the question" value={q.question_text} onChange={(e) => updateQuestion(i, { question_text: e.target.value })} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Question type</Label>
                      <Select value={q.question_type} onValueChange={(v) => v && updateQuestion(i, { question_type: v as ExamQuestionType })}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple choice</SelectItem>
                          <SelectItem value="short_answer">Short answer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Marks</Label>
                      <Input required type="number" min={1} value={q.marks} onChange={(e) => updateQuestion(i, { marks: e.target.value })} />
                    </div>
                  </div>
                  {q.question_type === "mcq" && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground">Fill in each option and select the correct answer.</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`correct-${i}`}
                              aria-label={`Mark option ${oi + 1} as correct`}
                              checked={q.correct_option_index === oi}
                              onChange={() => updateQuestion(i, { correct_option_index: oi })}
                              className="size-4 accent-primary"
                            />
                            <Input placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => updateOption(i, oi, e.target.value)} />
                          </label>
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => updateQuestion(i, { options: [...q.options, ""] })}>
                        <Plus /> Add option
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" className="w-fit" onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}>
                <Plus /> Add question
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Creating..." : "Create exam"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExamsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const canRecord = user?.role === "super_admin" || user?.role === "teacher" || user?.role === "staff";
  const isAdmin = user?.role === "super_admin" || user?.role === "head_of_institution" || user?.role === "group_principal";

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [failed, setFailed] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [now] = useState(() => new Date());

  const [createMode, setCreateMode] = useState<"questions" | "paper" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ExamStatus>("all");
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<Exam | null>(null);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    let examsFailed = false;
    Promise.all([
      api.listExams(token, schoolId).catch(() => {
        examsFailed = true;
        return [] as Exam[];
      }),
      api.listSubjects(token, schoolId).catch(() => [] as Subject[]),
      api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
    ]).then(([ex, ss, cs]) => {
      if (cancelled) return;
      setExams(ex);
      setSubjects(ss);
      setClasses(cs);
      setFailed(examsFailed);
      setDataLoading(false);
      setRetrying(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, reloadKey]);

  function retry() {
    setRetrying(true);
    setReloadKey((k) => k + 1);
  }

  const rows = useMemo<Row[]>(() => {
    const subjectById: Record<number, string> = {};
    for (const s of subjects) subjectById[s.id] = s.name;
    const classById: Record<number, string> = {};
    for (const c of classes) classById[c.id] = c.name;
    return exams.map((exam) => ({
      exam,
      status: statusOf(exam, now),
      className: exam.class_id ? classById[exam.class_id] ?? "Class" : "All classes",
      subjectName: subjectById[exam.subject_id] ?? "Subject",
      isPaper: Boolean(exam.paper_file_url),
      hasQuestions: exam.question_count > 0,
    }));
  }, [exams, subjects, classes, now]);

  if (loading || dataLoading) return <PageLoader />;

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!q) return true;
    return [r.exam.title, r.className, r.subjectName, r.exam.exam_type, r.exam.term].some((v) => v.toLowerCase().includes(q));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const from = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(from, from + PAGE_SIZE);

  async function togglePublish(row: Row) {
    if (!token || !schoolId) return;
    setBusyId(row.exam.id);
    try {
      const updated = await api.setExamPublished(token, schoolId, row.exam.id, !row.exam.is_published);
      setExams((all) => all.map((e) => (e.id === updated.id ? updated : e)));
      toast.success(updated.is_published ? "Published to learners" : "Moved back to draft");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update the exam");
    } finally {
      setBusyId(null);
    }
  }

  function startUpload(row: Row) {
    uploadTargetRef.current = row.exam;
    fileInputRef.current?.click();
  }

  async function uploadPaper(file: File) {
    const exam = uploadTargetRef.current;
    if (!token || !schoolId || !exam) return;
    setBusyId(exam.id);
    try {
      const updated = await api.uploadExamPaper(token, schoolId, exam.id, file);
      setExams((all) => all.map((e) => (e.id === updated.id ? updated : e)));
      toast.success("Exam paper uploaded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload the exam paper");
    } finally {
      setBusyId(null);
      uploadTargetRef.current = null;
    }
  }

  async function confirmDelete() {
    if (!token || !schoolId || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteExam(token, schoolId, deleteTarget.exam.id);
      setExams((all) => all.filter((e) => e.id !== deleteTarget.exam.id));
      toast.success("Exam deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete the exam");
    } finally {
      setDeleting(false);
    }
  }

  const primaryAction = (row: Row) => {
    const { exam } = row;
    if (row.hasQuestions) {
      return <Button size="sm" variant="outline" className="h-10 sm:h-8" nativeButton={false} render={<Link href={`/dashboard/exams/${exam.id}`}><Eye /> View</Link>} />;
    }
    if (row.isPaper && exam.paper_file_url) {
      return <Button size="sm" variant="outline" className="h-10 sm:h-8" nativeButton={false} render={<a href={exam.paper_file_url} target="_blank" rel="noreferrer"><FileText /> View paper</a>} />;
    }
    if (canRecord) {
      return (
        <Button size="sm" variant="outline" className="h-10 sm:h-8" onClick={() => startUpload(row)} disabled={busyId === exam.id}>
          <Upload /> Add paper
        </Button>
      );
    }
    return <span className="px-2 text-xs text-muted-foreground">Nothing to view yet</span>;
  };

  const menuFor = (row: Row) => (
    <ExamRowMenu
      row={row}
      canRecord={canRecord}
      isAdmin={isAdmin}
      busy={busyId === row.exam.id}
      onTogglePublish={() => togglePublish(row)}
      onUpload={() => startUpload(row)}
      onDelete={() => setDeleteTarget(row)}
    />
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_TYPES}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadPaper(file);
          e.target.value = "";
        }}
      />

      <ModuleBanner title="Exams" description={canRecord ? "Create and manage exams, set questions, and track results." : "See the exams teachers have set across the school."}>
        {canRecord && (
            <Button onClick={() => setCreateMode("questions")} className="h-10 sm:h-9">
              <Plus /> Create exam
            </Button>
          )}
      </ModuleBanner>

      <DepartmentPulse dept="exams" />

      {!canRecord && <ViewOnly>Teachers set and mark exams. You can see every exam, its results and how each class is doing.</ViewOnly>}

      {canRecord && (
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <ActionCard icon={FilePlus} tone="amber" title="Create exam" description="Set up an online exam with questions and a time limit." onClick={() => setCreateMode("questions")} />
          <ActionCard icon={FileUp} tone="sky" title="Upload a paper" description="Share a PDF or photo of a paper exam to sit in class." onClick={() => setCreateMode("paper")} />
          <ActionCard icon={ClipboardCheck} tone="emerald" title="Record results" description="Enter and review marks in the gradebook." href="/dashboard/results" />
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <h2 className="font-heading text-lg font-semibold">Recent exams</h2>
            {rows.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <div className="relative col-span-2 sm:w-56">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search exams..."
                    aria-label="Search exams"
                    className="h-10 pl-8 sm:h-9"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    if (v) {
                      setStatusFilter(v as "all" | ExamStatus);
                      setPage(1);
                    }
                  }}
                >
                  <SelectTrigger className="h-10 w-full sm:h-9 sm:w-40" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {failed ? (
            <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <AlertTriangle className="size-6 text-red-600" />
              <p className="text-sm text-muted-foreground">We couldn&apos;t load the exams.</p>
              <Button size="sm" variant="outline" onClick={retry} disabled={retrying}>
                <RotateCw className={retrying ? "animate-spin" : ""} /> Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No exams yet</p>
              <p className="text-xs text-muted-foreground">{canRecord ? "Create your first exam and it will appear here." : "Exams that teachers set will appear here."}</p>
              {canRecord && (
                <Button size="sm" className="mt-2" onClick={() => setCreateMode("questions")}>
                  <Plus /> Create exam
                </Button>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <p className="text-sm font-medium">No exams match your search</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden 2xl:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Title</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => (
                      <TableRow key={r.exam.id}>
                        <TableCell className="min-w-56 pl-5 whitespace-normal">
                          <div className="flex items-center gap-3">
                            <TypeTile type={r.exam.exam_type} />
                            <div className="min-w-0">
                              <p className="font-medium break-words">{r.exam.title}</p>
                              <p className="text-xs text-muted-foreground">
                                <FormatText row={r} />
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <p className="font-medium">{r.className}</p>
                          <p className="text-xs text-muted-foreground">{r.subjectName}</p>
                        </TableCell>
                        <TableCell>
                          <TypePill type={r.exam.exam_type} />
                          <p className="mt-1 text-xs text-muted-foreground">{r.exam.term}</p>
                        </TableCell>
                        <TableCell>
                          <WindowText exam={r.exam} />
                          {!r.isPaper && r.hasQuestions && <p className="text-xs text-muted-foreground">{formatDuration(r.exam.duration_minutes)} to sit</p>}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={r.status} />
                        </TableCell>
                        <TableCell className="pr-5">
                          <div className="flex items-center justify-end gap-1">
                            {primaryAction(r)}
                            {menuFor(r)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="flex flex-col divide-y 2xl:hidden">
                {visible.map((r) => (
                  <li key={r.exam.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <TypeTile type={r.exam.exam_type} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium break-words">{r.exam.title}</p>
                        <p className="text-xs text-muted-foreground">
                          <FormatText row={r} />
                        </p>
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{r.className}</span>
                      <span>{r.subjectName}</span>
                      <TypePill type={r.exam.exam_type} />
                      <span>{r.exam.term}</span>
                      {!r.isPaper && r.hasQuestions && <span>{formatDuration(r.exam.duration_minutes)}</span>}
                    </div>
                    {(r.exam.opens_at || r.exam.closes_at) && (
                      <div className="rounded-lg bg-muted/50 px-3 py-2">
                        <WindowText exam={r.exam} />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 [&>*]:flex-1 sm:[&>*]:flex-none">{primaryAction(r)}</div>
                      {menuFor(r)}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
                <p className="text-sm text-muted-foreground">
                  {totalPages === 1 ? `Showing ${filtered.length} of ${filtered.length} exam${filtered.length === 1 ? "" : "s"}` : `Showing ${from + 1}–${from + visible.length} of ${filtered.length} exams`}
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

        <aside className="flex flex-col gap-4">
          <section className="hidden rounded-xl border bg-card xl:block">
            <h2 className="border-b px-4 py-3 font-heading text-lg font-semibold">Quick actions</h2>
            <ul className="flex flex-col divide-y">
              {canRecord ? (
                <>
                  <li>
                    <button type="button" onClick={() => setCreateMode("questions")} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent/50">
                      <FilePlus className="size-4.5 text-primary" /> <span className="flex-1">Create new exam</span> <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => setCreateMode("paper")} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent/50">
                      <FileUp className="size-4.5 text-primary" /> <span className="flex-1">Upload an exam paper</span> <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                </>
              ) : null}
              <li>
                <Link href="/dashboard/results" className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/50">
                  <ClipboardCheck className="size-4.5 text-primary" /> <span className="flex-1">{canRecord ? "Record results" : "Review results"}</span> <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
              <li>
                <Link href="/dashboard/analytics" className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/50">
                  <BookOpenCheck className="size-4.5 text-primary" /> <span className="flex-1">Open analytics</span> <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 font-heading text-lg font-semibold">Exam formats</h2>
            <div className="grid grid-cols-3 gap-2 p-3 xl:grid-cols-2">
              {[
                { icon: ListChecks, label: "Multiple choice", tone: "amber" as const },
                { icon: TextCursorInput, label: "Short answer", tone: "sky" as const },
                { icon: FileUp, label: "Paper upload", tone: "emerald" as const },
              ].map(({ icon: Icon, label, tone }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center">
                  <span className={`flex size-9 items-center justify-center rounded-lg ${ICON_TONES[tone]}`}>
                    <Icon className="size-4.5" />
                  </span>
                  <span className="text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">Online exams support multiple-choice and short-answer questions. Paper exams are a PDF or photo you mark in Grading.</p>
          </section>
        </aside>
      </div>

      {canRecord && createMode && (
        <CreateExamDialog
          key={createMode}
          initialMode={createMode}
          classes={classes}
          subjects={subjects}
          onClose={() => setCreateMode(null)}
          onCreated={(exam) => {
            setExams((all) => [exam, ...all]);
            setPage(1);
          }}
        />
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this exam?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &ldquo;{deleteTarget?.exam.title}&rdquo; and every learner submission for it will be permanently removed. This cannot be undone.
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
