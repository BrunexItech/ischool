"use client";

import { useModuleTab } from "@/lib/moduleTabs";
import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookMarked, BookOpen, Library as LibraryIcon, Plus, ScanLine, Search, Undo2 } from "lucide-react";
import { api, ApiError, LibBook, LibBookDetail, LibClassSet, LibCopy, LibLoan, LibOverview, SchoolClass, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ClassStudentPicker } from "@/components/ClassStudentPicker";
import { PageHead, Pill, ViewOnly } from "@/components/oversight";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const STATUS_TONE = { available: "good", on_loan: "info", lost: "bad", withdrawn: "muted" } as const;
const STATUS_LABEL = { available: "On the shelf", on_loan: "Out", lost: "Lost", withdrawn: "Withdrawn" } as const;

function Stat({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-3.5 sm:p-4 ${warn ? "border-amber-300/70 dark:border-amber-700/50" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-heading text-2xl font-semibold tabular-nums ${warn ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function LoanTable({ loans, onReturn, empty }: { loans: LibLoan[]; onReturn?: (l: LibLoan) => void; empty: string }) {
  if (loans.length === 0) return <p className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="relative w-full max-w-full min-w-0 overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[44rem] text-sm">
        <thead><tr className="border-b bg-muted/50 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"><th scope="col" className="px-4 py-2.5">Book</th><th scope="col" className="px-3 py-2.5">No.</th><th scope="col" className="px-3 py-2.5">Borrower</th><th scope="col" className="px-3 py-2.5">Due</th><th scope="col" className="px-3 py-2.5">Status</th>{onReturn && <th scope="col" className="px-4 py-2.5 text-right"><span className="sr-only">Action</span></th>}</tr></thead>
        <tbody className="divide-y">
          {loans.map((l) => (
            <tr key={l.id} className="align-top">
              <td className="px-4 py-2.5"><span className="block font-medium">{l.title}</span><span className="block text-xs text-muted-foreground">{l.author}</span></td>
              <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{l.copy_number}</td>
              <td className="px-3 py-2.5"><span className="block">{l.borrower_name}</span><span className="block text-xs text-muted-foreground">{l.borrower_kind === "teacher" ? "Teacher, for " : ""}{l.class_name ?? ""}{l.via_teacher ? ` · via ${l.via_teacher}` : ""}</span></td>
              <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{fmt(l.due_date)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{!l.active ? <Pill tone="muted">Returned</Pill> : l.overdue ? <Pill tone="bad">{l.days_overdue} d overdue</Pill> : <Pill tone="info">Out</Pill>}</td>
              {onReturn && <td className="px-4 py-2.5 text-right">{l.active && <Button size="sm" variant="outline" className="h-9" onClick={() => onReturn(l)}><Undo2 /> Take back</Button>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MyBookCards({ loans }: { loans: LibLoan[] }) {
  if (loans.length === 0) return <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-4 py-14 text-center"><BookOpen className="size-6 text-muted-foreground" aria-hidden /><p className="font-medium">No books borrowed yet</p><p className="max-w-sm text-sm text-muted-foreground">Visit the Catalogue to find something to read, then ask the librarian to lend it.</p></div>;
  const out = loans.filter((l) => l.active);
  const back = loans.filter((l) => !l.active);
  const card = (l: LibLoan) => (
    <article key={l.id} className={`flex min-w-0 gap-4 rounded-2xl border bg-card p-4 shadow-xs ${l.overdue ? "border-red-200 dark:border-red-500/30" : ""}`}>
      <div className={`flex h-24 w-16 shrink-0 flex-col items-center justify-center rounded-lg text-white shadow-sm ${l.overdue ? "bg-gradient-to-br from-red-700 to-red-500" : l.active ? "bg-gradient-to-br from-[#0f3d4a] to-[#0E7490]" : "bg-gradient-to-br from-slate-500 to-slate-400"}`} aria-hidden>
        <BookOpen className="size-6" /><span className="mt-1 px-1 text-center text-[8px] leading-tight font-semibold uppercase opacity-80">{l.copy_number}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0"><p className="font-heading text-base leading-snug font-semibold break-words">{l.title}</p><p className="truncate text-sm text-muted-foreground">{l.author}</p><p className="truncate text-xs text-muted-foreground">Borrowed by {l.borrower_name}</p></div>
        <div className="flex flex-wrap items-center gap-2 text-xs">{!l.active ? <Pill tone="muted">Returned</Pill> : l.overdue ? <Pill tone="bad">{l.days_overdue} {l.days_overdue === 1 ? "day" : "days"} overdue</Pill> : <Pill tone="info">Due back {fmt(l.due_date)}</Pill>}</div>
      </div>
    </article>
  );
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {out.length > 0 && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{out.map(card)}</div>}
      {back.length > 0 && <div className="flex flex-col gap-3"><h2 className="font-heading text-base font-semibold">Returned</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{back.map(card)}</div></div>}
    </div>
  );
}

function ClassSets({ sets }: { sets: LibClassSet[] }) {
  if (sets.length === 0) return <EmptyNote>No teacher has borrowed books for a class.</EmptyNote>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {sets.map((s) => (
        <li key={`${s.loan_id}`} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{s.teacher_name}</p><p className="text-xs text-muted-foreground">{s.class_name ?? "No class named"} · due {fmt(s.due_date)}</p></div>{s.overdue ? <Pill tone="bad">Overdue</Pill> : <Pill tone="info">{s.copies} book{s.copies === 1 ? "" : "s"}</Pill>}</div>
          <p className="text-sm"><strong>{s.copies}</strong> book{s.copies === 1 ? "" : "s"}: {s.titles.join(", ")}</p>
          <p className="text-xs text-muted-foreground">{s.with_learners} with learners · {s.copies - s.with_learners} with the teacher</p>
          <p className="font-mono text-[11px] break-words text-muted-foreground">{s.copy_numbers.join("  ")}</p>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Catalogue ---------- */

function AddBookDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (b: LibBookDetail) => void }) {
  const { token, user } = useAuth();
  const [f, setF] = useState({ title: "", author: "", isbn: "", category: "", shelf: "", copies: "1" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setBusy(true);
    try {
      const d = await api.libAddBook(token, user.school_id, { title: f.title, author: f.author || undefined, isbn: f.isbn || undefined, category: f.category || undefined, shelf: f.shelf || undefined, copies: Number(f.copies) });
      toast.success(`${d.book.title} added with ${d.copies.length} cop${d.copies.length === 1 ? "y" : "ies"}`);
      onAdded(d);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't add the book.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Add a book</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label>Title</Label><Input required value={f.title} onChange={set("title")} className="h-10" autoFocus /></div>
          <div className="flex flex-col gap-1.5"><Label>Author</Label><Input value={f.author} onChange={set("author")} className="h-10" /></div>
          <div className="flex flex-col gap-1.5"><Label>ISBN</Label><Input value={f.isbn} onChange={set("isbn")} className="h-10" /></div>
          <div className="flex flex-col gap-1.5"><Label>Category</Label><Input value={f.category} onChange={set("category")} placeholder="Storybook, Textbook..." className="h-10" /></div>
          <div className="flex flex-col gap-1.5"><Label>Shelf</Label><Input value={f.shelf} onChange={set("shelf")} className="h-10" /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label>Number of copies</Label><Input required type="number" min={1} max={500} value={f.copies} onChange={set("copies")} className="h-10 w-32" /><p className="text-xs text-muted-foreground">Each copy gets its own number to write inside the cover.</p></div>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button><Button type="submit" className="h-11 sm:h-9" disabled={busy || !f.title.trim()}>{busy && <Spinner size={16} className="text-current" />} Add book</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Catalogue({ schoolId, canAdd, showHolders }: { schoolId: number; canAdd: boolean; showHolders: boolean }) {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [books, setBooks] = useState<LibBook[] | null>(null);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<LibBookDetail | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api.libBooks(token, schoolId, { q: q || undefined, available_only: onlyFree }).then((b) => !cancelled && setBooks(b)).catch(() => !cancelled && setBooks([]));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, schoolId, q, onlyFree, version]);

  async function show(b: LibBook) {
    if (!token) return;
    try {
      setOpen(await api.libBook(token, schoolId, b.id));
    } catch {
      toast.error("We couldn't open that book.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, author, ISBN or book number..." aria-label="Search the catalogue" className="h-10 pl-8" /></div>
        <button type="button" aria-pressed={onlyFree} onClick={() => setOnlyFree((v) => !v)} className={`h-10 rounded-full border px-4 text-sm font-medium ${onlyFree ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>On the shelf now</button>
        {canAdd && <Button className="h-10 sm:ml-auto" onClick={() => setAdding(true)}><Plus /> Add a book</Button>}
      </div>
      {!books ? <PageLoader /> : books.length === 0 ? (
        <EmptyNote>{q ? "No book matches." : "The catalogue is empty."}</EmptyNote>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => show(b)} className="flex h-full w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block font-medium break-words">{b.title}</span><span className="block text-xs text-muted-foreground">{b.author ?? "Unknown author"}{b.category ? ` · ${b.category}` : ""}</span></span>{b.available > 0 ? <Pill tone="good">{b.available} free</Pill> : <Pill tone="warn">All out</Pill>}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{b.total_copies} cop{b.total_copies === 1 ? "y" : "ies"} · {b.on_loan} out{b.lost ? ` · ${b.lost} lost` : ""}{b.shelf ? ` · shelf ${b.shelf}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle>{open.book.title}</DialogTitle></DialogHeader>
            <p className="-mt-2 text-sm text-muted-foreground">{open.book.author ?? ""}{open.book.isbn ? ` · ISBN ${open.book.isbn}` : ""}</p>
            <ul className="divide-y rounded-lg border">
              {open.copies.map((c: LibCopy) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span><span className="font-mono text-xs">{c.copy_number}</span> <span className="text-xs text-muted-foreground">· {c.condition}</span></span>
                  <span className="flex items-center gap-2">
                    {showHolders && c.holder && <span className="text-xs text-muted-foreground">{c.holder.name}{c.holder.via_teacher ? ` (via ${c.holder.via_teacher})` : ""} · due {fmt(c.holder.due_date)}</span>}
                    <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
                  </span>
                </li>
              ))}
            </ul>
            {canAdd && <Button variant="outline" className="h-10 w-fit" onClick={async () => { if (!token) return; try { setOpen(await api.libAddCopies(token, schoolId, open.book.id, 1)); setVersion((v) => v + 1); } catch { toast.error("We couldn't add a copy."); } }}><Plus /> Add one more copy</Button>}
          </DialogContent>
        </Dialog>
      )}
      {adding && <AddBookDialog onClose={() => setAdding(false)} onAdded={(d) => { setAdding(false); setVersion((v) => v + 1); setOpen(d); }} />}
    </div>
  );
}

/* ---------- Librarian desk ---------- */

function Desk({ schoolId }: { schoolId: number }) {
  const { token } = useAuth();
  const [number, setNumber] = useState("");
  const [copy, setCopy] = useState<LibCopy | null>(null);
  const [mode, setMode] = useState<"learner" | "teacher">("learner");
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<{ user_id: number; full_name: string }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.listClasses(token, schoolId), api.listStudents(token, schoolId), api.libTeachers(token, schoolId)]).then(([c, s, t]) => { setClasses(c); setStudents(s); setTeachers(t); }).catch(() => undefined);
  }, [token, schoolId]);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !number.trim()) return;
    try {
      setCopy(await api.libCopy(token, schoolId, number.trim()));
    } catch (err) {
      setCopy(null);
      toast.error(err instanceof ApiError ? err.message : "We couldn't find that book.");
    }
  }

  async function lend() {
    if (!token || !copy) return;
    setBusy(true);
    try {
      const body = mode === "learner" ? { copy_number: copy.copy_number, student_id: Number(studentId) } : { copy_number: copy.copy_number, teacher_user_id: Number(teacherId), for_class_id: classId ? Number(classId) : undefined };
      const loan = await api.libIssue(token, schoolId, body);
      toast.success(`${loan.copy_number} lent to ${loan.borrower_name}, due ${fmt(loan.due_date)}`);
      setCopy(await api.libCopy(token, schoolId, copy.copy_number));
      setStudentId("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't lend that book.");
    } finally {
      setBusy(false);
    }
  }

  async function takeBack(condition: string) {
    if (!token || !copy?.holder) return;
    setBusy(true);
    try {
      await api.libReturn(token, schoolId, copy.holder.loan_id, condition);
      toast.success(condition === "lost" ? "Marked as lost" : "Book taken back");
      setCopy(await api.libCopy(token, schoolId, copy.copy_number));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't take that back.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <form onSubmit={find} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><ScanLine className="size-4.5 text-primary" aria-hidden /> Book number</h2>
        <p className="text-sm text-muted-foreground">Type or scan the number inside the cover to lend the book or take it back.</p>
        <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="BK-000123" aria-label="Book number" className="h-12 font-mono text-base" autoFocus />
        <Button type="submit" className="h-11" disabled={!number.trim()}>Find</Button>
      </form>
      <div>
        {!copy ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center"><BookMarked className="size-6 text-muted-foreground" aria-hidden /><p className="text-sm text-muted-foreground">Find a book by its number to see where it is.</p></div>
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-sm">{copy.copy_number}</p><p className="text-xs text-muted-foreground">Condition: {copy.condition}</p></div><Pill tone={STATUS_TONE[copy.status]}>{STATUS_LABEL[copy.status]}</Pill></div>
            {copy.holder && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                <p><strong>{copy.holder.name}</strong> has this book{copy.holder.class_name ? ` (${copy.holder.class_name})` : ""}.</p>
                {copy.holder.via_teacher && <p className="text-xs text-muted-foreground">Given by {copy.holder.via_teacher}</p>}
                <p className={`text-xs ${copy.holder.overdue ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>Due {fmt(copy.holder.due_date)}{copy.holder.overdue ? " (overdue)" : ""}</p>
                <div className="mt-3 flex flex-wrap gap-2"><Button className="h-10" disabled={busy} onClick={() => takeBack("good")}><Undo2 /> Take back</Button><Button variant="outline" className="h-10" disabled={busy} onClick={() => takeBack("poor")}>Back, damaged</Button><Button variant="outline" className="h-10" disabled={busy} onClick={() => takeBack("lost")}>Mark lost</Button></div>
              </div>
            )}
            {copy.status === "available" && (
              <div className="flex flex-col gap-3">
                <div role="group" aria-label="Lend to" className="inline-flex w-fit rounded-lg border p-0.5">
                  {([["learner", "A learner"], ["teacher", "A teacher, for a class"]] as const).map(([k, label]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`h-9 rounded-md px-3 text-sm font-medium ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>)}
                </div>
                {mode === "learner" ? (
                  <div className="flex flex-wrap items-end gap-3"><ClassStudentPicker classes={classes} students={students} value={studentId} onChange={setStudentId} /></div>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Teacher" className="h-10 min-w-48 rounded-lg border bg-background px-3 text-sm"><option value="">Choose a teacher</option>{teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name}</option>)}</select>
                    <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class" className="h-10 min-w-44 rounded-lg border bg-background px-3 text-sm"><option value="">For which class?</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  </div>
                )}
                <Button className="h-11 w-fit" disabled={busy || (mode === "learner" ? !studentId : !teacherId || !classId)} onClick={lend}>{busy && <Spinner size={16} className="text-current" />} Lend this book</Button>
              </div>
            )}
            {copy.status === "lost" && <p className="text-sm text-muted-foreground">This copy is recorded as lost.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Teacher ---------- */

function TeacherShelf({ schoolId }: { schoolId: number }) {
  const { token } = useAuth();
  const [data, setData] = useState<{ sets: LibClassSet[]; learner_loans: LibLoan[] } | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [copyNo, setCopyNo] = useState("");
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([api.libMine(token, schoolId), api.listClasses(token, schoolId), api.listStudents(token, schoolId)]).then(([d, c, s]) => { if (!cancelled) { setData(d); setClasses(c); setStudents(s); } }).catch(() => !cancelled && setData({ sets: [], learner_loans: [] }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, version]);

  const held = useMemo(() => {
    const withKids = new Set(data?.learner_loans.map((l) => l.copy_number));
    return (data?.sets ?? []).flatMap((s) => s.copy_numbers.map((n) => ({ n, title: s.titles.join(", "), cls: s.class_name }))).filter((h) => !withKids.has(h.n));
  }, [data]);

  async function give(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !copyNo || !studentId) return;
    setBusy(true);
    try {
      const l = await api.libIssue(token, schoolId, { copy_number: copyNo, student_id: Number(studentId) });
      toast.success(`${l.copy_number} given to ${l.borrower_name}`);
      setCopyNo("");
      setStudentId("");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't give that book out.");
    } finally {
      setBusy(false);
    }
  }

  async function back(l: LibLoan) {
    if (!token) return;
    try {
      await api.libReturn(token, schoolId, l.id);
      toast.success("Book is back with you");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't record that.");
    }
  }

  if (!data) return <PageLoader />;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ClassSets sets={data.sets} />
      {data.sets.length > 0 && (
        <form onSubmit={give} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h3 className="font-heading text-base font-semibold">Give a book to a learner</h3>
          <div className="flex flex-wrap items-end gap-3">
            <select value={copyNo} onChange={(e) => setCopyNo(e.target.value)} aria-label="Book" className="h-10 min-w-56 rounded-lg border bg-background px-3 text-sm"><option value="">Choose one of your books</option>{held.map((h) => <option key={h.n} value={h.n}>{h.n} · {h.title}</option>)}</select>
            <ClassStudentPicker classes={classes} students={students} value={studentId} onChange={setStudentId} />
            <Button type="submit" className="h-10" disabled={busy || !copyNo || !studentId}>Give book</Button>
          </div>
          {held.length === 0 && <p className="text-xs text-muted-foreground">Every book you hold is already with a learner.</p>}
        </form>
      )}
      <section aria-label="Books with learners" className="flex min-w-0 flex-col gap-2">
        <h3 className="font-heading text-base font-semibold">With learners now</h3>
        <LoanTable loans={data.learner_loans} onReturn={back} empty="No learner has one of your books." />
      </section>
    </div>
  );
}

/* ---------- Overview (head) ---------- */

function Overview({ ov }: { ov: LibOverview }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Library at a glance">
        <Stat label="Titles" value={ov.titles} sub={`${ov.copies} copies`} />
        <Stat label="On the shelf" value={ov.available} sub="available to borrow" />
        <Stat label="Out on loan" value={ov.on_loan} sub={`${ov.borrowers_now} learners reading`} />
        <Stat label="Overdue" value={ov.overdue} sub="past their due date" warn={ov.overdue > 0} />
        <Stat label="Lost" value={ov.lost} sub="written off" warn={ov.lost > 0} />
      </section>
      <section className="flex flex-col gap-2"><h3 className="font-heading text-base font-semibold">Books teachers hold for their classes</h3><ClassSets sets={ov.class_sets} /></section>
      <section className="flex flex-col gap-2"><h3 className="font-heading text-base font-semibold">Overdue</h3><LoanTable loans={ov.overdue_loans} empty="Nothing is overdue." /></section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-2"><h3 className="font-heading text-base font-semibold">Most borrowed</h3>{ov.popular.length === 0 ? <p className="text-sm text-muted-foreground">No loans yet.</p> : <ol className="divide-y rounded-xl border bg-card">{ov.popular.map((p, i) => <li key={p.title} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span><span className="mr-2 text-xs text-muted-foreground tabular-nums">{i + 1}</span>{p.title}</span><span className="tabular-nums text-muted-foreground">{p.loans} loan{p.loans === 1 ? "" : "s"}</span></li>)}</ol>}</section>
        <section className="flex flex-col gap-2"><h3 className="font-heading text-base font-semibold">Recent activity</h3><ul className="divide-y rounded-xl border bg-card">{ov.recent.length === 0 ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing yet.</li> : ov.recent.slice(0, 8).map((l) => <li key={l.id} className="px-4 py-2.5 text-sm"><span className="font-medium">{l.title}</span> <span className="font-mono text-xs text-muted-foreground">{l.copy_number}</span><span className="block text-xs text-muted-foreground">{l.active ? "Lent to" : "Returned by"} {l.borrower_name}{l.via_teacher ? ` via ${l.via_teacher}` : ""} · {new Date(l.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></li>)}</ul></section>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function LibraryPage() {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const role = user?.role;
  const keeper = role === "librarian" || role === "super_admin";
  const overseer = role === "head_of_institution" || role === "group_principal";
  const teacher = role === "teacher";
  const learner = role === "student" || role === "parent";

  const tabs: [string, string][] = keeper
    ? [["desk", "Lend and return"], ["catalogue", "Catalogue"], ["loans", "Who has what"], ["overview", "Overview"]]
    : overseer
      ? [["overview", "Overview"], ["loans", "Who has what"], ["catalogue", "Catalogue"]]
      : teacher
        ? [["shelf", "My class books"], ["catalogue", "Catalogue"]]
        : learner
          ? [["mine", role === "parent" ? "My child's books" : "My books"], ["catalogue", "Catalogue"]]
          : [["catalogue", "Catalogue"]];
  const urlTab = useModuleTab("library");
  const [tab, setTab] = useState<string | null>(null);
  const view = urlTab ? (urlTab) : (tab ?? tabs[0][0]);

  const [ov, setOv] = useState<LibOverview | null>(null);
  const [loans, setLoans] = useState<LibLoan[] | null>(null);
  const [state, setState] = useState("active");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState<LibLoan[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    if (view === "overview" && (keeper || overseer)) api.libOverview(token, schoolId).then((o) => !cancelled && setOv(o)).catch(() => undefined);
    if (view === "loans" && (keeper || overseer)) api.libLoans(token, schoolId, { state, q: q || undefined }).then((l) => !cancelled && setLoans(l)).catch(() => !cancelled && setLoans([]));
    if (view === "mine" && learner) api.libMyBooks(token, schoolId).then((l) => !cancelled && setMine(l)).catch(() => !cancelled && setMine([]));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, view, state, q, keeper, overseer, learner, version]);

  if (!user || !schoolId) return <PageLoader />;

  async function takeBack(l: LibLoan) {
    if (!token || !schoolId) return;
    try {
      await api.libReturn(token, schoolId, l.id);
      toast.success("Book taken back");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't take that back.");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <PageHead title="Library" subtitle={keeper ? "Lend books, take them back, and keep the catalogue." : overseer ? "The state of the library, and who holds which books." : teacher ? "The books you hold for your class, and who has each one." : "Find a book, and see the ones you have borrowed."}>
        <LibraryIcon className="hidden size-5 text-muted-foreground sm:block" aria-hidden />
      </PageHead>
      {overseer && <ViewOnly label="Oversight">The librarian lends and takes back books. You can see every book and who has it.</ViewOnly>}
      {tabs.length > 1 && (
        <div role="tablist" className={`${urlTab ? "hidden " : ""}flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1`}>
          {tabs.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setTab(k)} className={`h-9 shrink-0 rounded-md px-4 text-sm font-medium ${view === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
        </div>
      )}
      {view === "desk" && <Desk schoolId={schoolId} />}
      {view === "catalogue" && <Catalogue schoolId={schoolId} canAdd={keeper} showHolders={keeper || overseer || teacher} />}
      {view === "shelf" && <TeacherShelf schoolId={schoolId} />}
      {view === "overview" && (ov ? <Overview ov={ov} /> : <PageLoader />)}
      {view === "loans" && (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5" role="group" aria-label="Which loans">
              {[["active", "Out now"], ["overdue", "Overdue"], ["returned", "Returned"], ["all", "All"]].map(([k, label]) => <button key={k} type="button" aria-pressed={state === k} onClick={() => setState(k)} className={`h-9 rounded-full border px-3.5 text-sm font-medium ${state === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{label}</button>)}
            </div>
            <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Book, number or borrower..." aria-label="Search loans" className="h-9 pl-8" /></div>
          </div>
          {loans ? <LoanTable loans={loans} onReturn={keeper ? takeBack : undefined} empty="No loans match." /> : <PageLoader />}
        </div>
      )}
      {view === "mine" && (mine ? <MyBookCards loans={mine} /> : <PageLoader />)}
      {!keeper && !overseer && !teacher && !learner && <p className="text-sm text-muted-foreground"><BookOpen className="mr-1 inline size-4" aria-hidden />Browse the catalogue above.</p>}
    </div>
  );
}
