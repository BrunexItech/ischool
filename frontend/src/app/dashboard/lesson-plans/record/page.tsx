"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Printer, RotateCw } from "lucide-react";
import { api, AcademicTerm, RecordOfWorkRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { BackButton } from "@/components/BackButton";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REASON: Record<string, string> = { teacher_absent: "Teacher away", public_holiday: "Public holiday", exams: "Exams", school_event: "School event", other: "Other" };
const STATUS: Record<string, string> = { taught: "Taught", partly: "Partly taught", not_taught: "Not taught" };

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function RecordOfWorkPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isAdmin = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";
  const allowed = user?.role === "teacher" || isAdmin;

  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState(localDateStr());
  const [rows, setRows] = useState<{ key: string; list: RecordOfWorkRow[] | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!loading && user && !allowed) router.replace("/dashboard");
  }, [loading, user, allowed, router]);

  // Default range: the start of the current term (or the last 30 days).
  useEffect(() => {
    if (!token || !schoolId || from !== null) return;
    let cancelled = false;
    api
      .listAcademicTerms(token, schoolId)
      .catch(() => [] as AcademicTerm[])
      .then((terms) => {
        if (cancelled) return;
        const current = terms.find((t) => t.is_current) ?? terms[0];
        setFrom(current?.start_date ?? addDaysStr(localDateStr(), -30));
      });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, from]);

  const key = `${from}/${to}/${reloadKey}`;
  useEffect(() => {
    if (!token || !schoolId || !from || !allowed) return;
    let cancelled = false;
    api
      .getRecordOfWork(token, schoolId, { date_from: from, date_to: to })
      .then((list) => !cancelled && setRows({ key, list }))
      .catch(() => !cancelled && setRows({ key, list: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, from, to, allowed, key]);

  const counts = useMemo(() => {
    const list = rows?.list ?? [];
    return { taught: list.filter((r) => r.status === "taught").length, partly: list.filter((r) => r.status === "partly").length, not: list.filter((r) => r.status === "not_taught").length };
  }, [rows]);

  if (loading || !allowed || from === null) return <PageLoader />;
  const ready = rows && rows.key === key;
  const list = ready ? rows.list : null;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-5 print:hidden sm:gap-6">
        <BackButton fallback="/dashboard/lesson-plans" label="Lesson plans" />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Record of work covered</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Every lesson teachers have marked." : "Every lesson you have marked, ready to print for your file."}</p>
          </div>
          <Button className="h-10 sm:h-9" onClick={() => window.print()} disabled={!list || list.length === 0}><Printer /> Print</Button>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="grid gap-1.5">
            <Label>From</Label>
            <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-10" />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-10" />
          </div>
        </div>

        {list && list.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground tabular-nums">{counts.taught}</strong> taught
            {counts.partly > 0 && <> · {counts.partly} partly</>}
            {counts.not > 0 && <> · {counts.not} not taught</>}
          </p>
        )}
      </div>

      {!ready ? (
        <PageLoader />
      ) : list === null ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the record.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
        </div>
      ) : list.length === 0 ? (
        <EmptyNote>No lessons marked between these dates yet.</EmptyNote>
      ) : (
        <>
          <div className="hidden print:block">
            <div className="flex items-center justify-between border-b pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Milai-School-Logo.svg" alt="Milai School" className="h-16 w-auto" />
              <div className="text-right">
                <h1 className="text-xl font-bold">Record of Work Covered</h1>
                <p className="text-sm">{fromLabel(from)} to {fromLabel(to)}</p>
                {!isAdmin && <p className="text-sm">Teacher: {user?.full_name}</p>}
              </div>
            </div>
          </div>

          <ul className="flex flex-col gap-2 md:hidden print:hidden">
            {list.map((r) => (
              <li key={r.id} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{fmtDate(r.lesson_date)} · {r.start_time.slice(0, 5)}</p>
                <p className="mt-0.5 font-medium">{r.subject_name} <span className="font-normal text-muted-foreground">· {r.class_name}</span></p>
                {isAdmin && <p className="text-xs text-muted-foreground">{r.teacher_name}</p>}
                <p className="mt-1 text-sm break-words">{r.topic ?? "No planned topic"}</p>
                <p className="mt-1 text-xs font-medium">{STATUS[r.status]}{r.reason ? `: ${REASON[r.reason] ?? r.reason}` : ""}</p>
                {r.remark && <p className="mt-1 text-sm break-words text-muted-foreground">&ldquo;{r.remark}&rdquo;</p>}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block print:overflow-visible print:rounded-none print:border-0">
            <table className="w-full border-collapse text-sm print:text-xs">
              <thead>
                <tr className="bg-muted/60 text-left print:bg-neutral-100">
                  {["Date", "Time", ...(isAdmin ? ["Teacher"] : []), "Class", "Subject", "Work covered", "Status", "Remarks"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase print:border print:border-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap print:border print:border-neutral-400">{fmtDate(r.lesson_date)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums print:border print:border-neutral-400">{r.start_time.slice(0, 5)}</td>
                    {isAdmin && <td className="px-3 py-2.5 print:border print:border-neutral-400">{r.teacher_name}</td>}
                    <td className="px-3 py-2.5 print:border print:border-neutral-400">{r.class_name}</td>
                    <td className="px-3 py-2.5 print:border print:border-neutral-400">{r.subject_name}</td>
                    <td className="px-3 py-2.5 font-medium print:border print:border-neutral-400">{r.topic ?? "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap print:border print:border-neutral-400">{STATUS[r.status]}{r.reason ? `: ${REASON[r.reason] ?? r.reason}` : ""}</td>
                    <td className="px-3 py-2.5 text-muted-foreground print:border print:border-neutral-400">{r.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 hidden justify-between text-xs print:flex"><span>Teacher: ____________________</span><span>Head of institution: ____________________</span></div>
        </>
      )}
    </div>
  );
}

function fromLabel(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
