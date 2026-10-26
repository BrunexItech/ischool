"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Crown, Download, FileSpreadsheet, FileText, Printer, RotateCw, Users } from "lucide-react";
import { api, ResultsBoard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadBoardPdf, downloadBoardXlsx } from "@/lib/boardExport";
import { BackButton } from "@/components/BackButton";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LEVEL_STYLES = [
  "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100",
  "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
];

interface ClassOption {
  id: number;
  name: string;
}

interface Setup {
  classes: ClassOption[];
  terms: string[];
  currentTerm: string;
}

async function loadSetup(token: string, schoolId: number, isTeacher: boolean): Promise<Setup> {
  const [classes, terms] = await Promise.all([
    isTeacher
      ? api.listMyClasses(token, schoolId).then((mine) => mine.filter((c) => c.is_homeroom_teacher).map((c) => ({ id: c.class_id, name: c.class_name })))
      : api.listClasses(token, schoolId).then((all) => all.map((c) => ({ id: c.id, name: c.name }))),
    api.listAcademicTerms(token, schoolId).catch(() => []),
  ]);
  const current = terms.find((t) => t.is_current) ?? terms[0];
  return { classes, terms: terms.map((t) => t.name), currentTerm: current?.name ?? "" };
}

function BoardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isTeacher = user?.role === "teacher";
  const allowed = isTeacher || user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";

  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupFailed, setSetupFailed] = useState(false);
  const [classId, setClassId] = useState<number | null>(() => {
    const v = searchParams.get("class_id");
    return v ? Number(v) : null;
  });
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [board, setBoard] = useState<ResultsBoard | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [boardFailed, setBoardFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  useEffect(() => {
    if (!loading && user && !allowed) router.replace("/dashboard/results");
  }, [loading, user, allowed, router]);

  useEffect(() => {
    if (!token || !schoolId || !allowed) return;
    let cancelled = false;
    loadSetup(token, schoolId, isTeacher)
      .then((s) => {
        if (cancelled) return;
        setSetup(s);
        setTerm((t) => t || s.currentTerm);
        setClassId((c) => (c !== null && s.classes.some((x) => x.id === c) ? c : (s.classes[0]?.id ?? null)));
      })
      .catch(() => !cancelled && setSetupFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, allowed]);

  const typesKey = picked.join("|");
  const requestKey = `${classId}/${term}/${typesKey}/${reloadKey}`;

  useEffect(() => {
    if (!token || !schoolId || classId === null || !term) return;
    let cancelled = false;
    api
      .getResultsBoard(token, schoolId, classId, term, typesKey ? typesKey.split("|") : [])
      .then((b) => {
        if (cancelled) return;
        setBoard(b);
        setAvailable(b.available_exam_types);
        setBoardFailed(false);
        setLoadedKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setBoardFailed(true);
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, classId, term, typesKey, reloadKey, requestKey]);

  const levelStyle = useMemo(() => {
    const map: Record<string, string> = {};
    board?.bands.forEach((b, i) => (map[b.level_code] = LEVEL_STYLES[i % LEVEL_STYLES.length]));
    return map;
  }, [board]);

  if (loading || !allowed) return <PageLoader />;
  if (!setup && !setupFailed) return <PageLoader />;

  const fetching = loadedKey !== requestKey && classId !== null && !!term;
  const top = board?.ranked ? board.students.find((s) => s.rank === 1) : undefined;
  const reportCardQuery = picked.length ? `?exam_types=${encodeURIComponent(picked.join(","))}` : "";

  function toggleType(t: string) {
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  }

  async function exportAs(kind: "pdf" | "xlsx") {
    if (!board) return;
    setExporting(kind);
    try {
      await (kind === "pdf" ? downloadBoardPdf(board) : downloadBoardXlsx(board));
    } catch {
      toast.error("The file could not be created. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <style>{`@media print { @page { size: landscape; margin: 10mm; } }`}</style>
      <BackButton fallback="/dashboard/results" label="Grading" />

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#6e1316] px-5 py-4 text-primary-foreground shadow-sm sm:px-6 sm:py-5 print:bg-none print:p-0 print:text-foreground print:shadow-none">
        <span className="absolute inset-y-0 left-0 w-1 bg-sidebar-primary print:hidden" aria-hidden />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Class results{board ? `: ${board.class_name}` : ""}</h1>
            <p className="text-sm text-primary-foreground/80 print:text-muted-foreground">
              {term || "No term set"} · {picked.length ? `Compiled from ${picked.join(", ")}` : "All exams averaged"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button onClick={() => window.print()} disabled={!board} className="h-10 bg-white/15 text-white hover:bg-white/25 sm:h-9">
              <Printer /> Print
            </Button>
            <Button onClick={() => exportAs("pdf")} disabled={!board || exporting !== null} className="h-10 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:h-9">
              {exporting === "pdf" ? <Spinner size={16} className="text-current" /> : <FileText />} PDF
            </Button>
            <Button onClick={() => exportAs("xlsx")} disabled={!board || exporting !== null} className="h-10 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:h-9">
              {exporting === "xlsx" ? <Spinner size={16} className="text-current" /> : <FileSpreadsheet />} Excel
            </Button>
          </div>
        </div>
      </div>

      {setupFailed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load your classes.</p>
        </div>
      ) : setup && setup.classes.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          {isTeacher ? "You are not the class teacher of any class, so there is no class results board for you." : "There are no classes yet."}
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5 print:hidden">
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
              <label className="grid gap-1.5 text-sm font-medium">
                Class
                <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
                  <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                  <SelectContent>{setup?.classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Term
                <Select value={term} onValueChange={(v) => v && setTerm(v)}>
                  <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose a term" /></SelectTrigger>
                  <SelectContent>{setup?.terms.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Exams to compile</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Exams to compile">
                <button
                  type="button"
                  aria-pressed={picked.length === 0}
                  onClick={() => setPicked([])}
                  className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors sm:h-9 ${picked.length === 0 ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  All exams
                </button>
                {available.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={picked.includes(t)}
                    onClick={() => toggleType(t)}
                    className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors sm:h-9 ${picked.includes(t) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Pick one exam to see how learners did in it, or several to get the average of exactly those exams (for example CAT 1, CAT 2 and Mid Term).
              </p>
            </div>
          </section>

          {board && (
            <div className="flex flex-wrap gap-2" aria-label="Performance levels">
              {board.bands.map((b, i) => (
                <span key={b.level_code} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${LEVEL_STYLES[i % LEVEL_STYLES.length]}`}>
                  <strong>{b.level_code}</strong> {b.label} · {b.min_score}–{b.max_score}
                </span>
              ))}
            </div>
          )}

          {boardFailed ? (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
              <AlertTriangle className="size-6 text-red-600" />
              <p className="text-sm text-muted-foreground">We couldn&apos;t load the class results.</p>
              <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
            </div>
          ) : !board || fetching ? (
            <PageLoader />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile icon={<Users className="size-5" />} label="Learners" value={String(board.students.length)} />
                <Tile label="Class average" value={board.class_average !== null ? String(board.class_average) : "—"} />
                <Tile label="Subjects" value={String(board.subjects.length)} />
                <Tile icon={<Crown className="size-5" />} label="Top learner" value={top && top.average !== null ? top.name : "—"} sub={top && top.average !== null ? `Average ${top.average}` : undefined} />
              </div>

              {!board.ranked && (
                <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  Pre-Primary learners are not ranked, so this class is listed alphabetically.
                </p>
              )}

              {board.students.length === 0 ? (
                <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No learners in this class yet.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <table className="w-full min-w-max border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted text-left">
                        <th className="sticky left-0 z-10 w-14 bg-muted px-3 py-3 text-center text-xs font-semibold tracking-wide uppercase">Pos</th>
                        <th className="sticky left-14 z-10 min-w-48 bg-muted px-3 py-3 text-xs font-semibold tracking-wide uppercase">Learner</th>
                        {board.subjects.map((s) => (
                          <th key={s.id} className="px-2 py-3 text-center text-xs font-semibold tracking-wide uppercase">{s.name}</th>
                        ))}
                        <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide uppercase">Total</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide uppercase">Average</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide uppercase">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.students.map((s, i) => (
                        <tr key={s.student_id} className="border-t">
                          <td className="sticky left-0 z-10 bg-card px-3 py-2 text-center">
                            <span className={`inline-flex size-8 items-center justify-center rounded-full text-xs font-bold tabular-nums ${s.rank === 1 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                              {s.rank ?? i + 1}
                            </span>
                          </td>
                          <td className="sticky left-14 z-10 bg-card px-3 py-2">
                            <Link href={`/dashboard/report-card/${s.student_id}${reportCardQuery}`} className="font-medium hover:underline">{s.name}</Link>
                            <p className="text-xs text-muted-foreground">Adm. {s.admission_number}</p>
                          </td>
                          {board.subjects.map((sub) => {
                            const v = s.scores[sub.id];
                            const code = s.levels[sub.id];
                            return (
                              <td key={sub.id} className="px-2 py-2 text-center">
                                {v === null || v === undefined ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <span className={`inline-flex min-w-16 flex-col items-center rounded-md border px-2 py-1 leading-tight ${code ? levelStyle[code] : ""}`}>
                                    <span className="font-semibold tabular-nums">{Number(v.toFixed(1))}</span>
                                    {code && <span className="text-[10px] font-medium opacity-80">{code}</span>}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-semibold tabular-nums">{s.subjects_marked ? Number(s.total.toFixed(1)) : "—"}</td>
                          <td className="px-3 py-2 text-center font-semibold tabular-nums">{s.average !== null ? Number(s.average.toFixed(1)) : "—"}</td>
                          <td className="px-3 py-2 text-center">
                            {s.level ? <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${levelStyle[s.level]}`}>{s.level}</span> : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
                <Download className="size-3.5" /> This board is read-only. Marks are entered by each subject&apos;s own teacher in the Gradebook.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 sm:p-4">
      {icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>}
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-xl font-semibold break-words tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function ResultsBoardPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <BoardView />
    </Suspense>
  );
}
