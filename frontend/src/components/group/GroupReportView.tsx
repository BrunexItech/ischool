"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Printer } from "lucide-react";
import { api, ApiError, GroupWeeklyReport } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Bar, formatValue, GroupSkeleton, kes, useGroupMode, useOpenSchool } from "@/components/group/GroupUi";
import { ErrorBox } from "@/components/oversight";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

/** The principal's weekly report: the same picture that is emailed on Saturday morning, always available here. */
export function GroupReportView() {
  const { token } = useAuth();
  const { ready } = useGroupMode();
  const openSchool = useOpenSchool();
  const [data, setData] = useState<GroupWeeklyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    if (!token || !ready) return;
    let cancelled = false;
    api.getGroupReport(token).then((d) => { if (!cancelled) { setData(d); setFailed(false); } }).catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token, ready, version]);

  async function email() {
    if (!token) return;
    setEmailing(true);
    try {
      const r = await api.emailGroupReport(token);
      if (r.sent) toast.success("The report is on its way to your inbox");
      else toast.error("Email is not set up on this server yet, or there is nothing to send.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't send the report.");
    } finally {
      setEmailing(false);
    }
  }

  if (failed) return <ErrorBox message="We couldn't build the report just now." onRetry={() => { setData(null); setFailed(false); setVersion((v) => v + 1); }} />;
  if (!data) return <GroupSkeleton rows={2} />;
  const range = `${new Date(data.week_start + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${new Date(data.week_end + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Weekly report · All Schools</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Your schools this week</h1>
          <p className="mt-1 text-sm text-muted-foreground">Week of {range}. Emailed to you every Saturday morning.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" className="h-10 sm:h-9" onClick={email} disabled={emailing}>{emailing ? <Spinner size={16} className="text-current" /> : <Mail />} Email it to me</Button>
          <Button variant="outline" className="h-10 sm:h-9" onClick={() => window.print()}><Printer /> Print or save as PDF</Button>
        </div>
      </header>

      <p className="rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3.5 text-[0.95rem] font-semibold">{data.headline}</p>

      {data.spotlight.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-sm sm:p-5">{data.spotlight.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden /><span>{t}</span></li>)}</ul>
      )}

      <section aria-label="Schools" className="overflow-hidden rounded-xl border bg-card">
        <h2 className="border-b bg-muted/30 px-4 py-3 font-heading text-lg font-semibold sm:px-5">Your schools</h2>
        <ul className="divide-y">
          {data.schools.map((c) => (
            <li key={c.school_id} className="grid gap-3 px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0"><p className="font-medium break-words">{c.name}</p><p className="text-xs text-muted-foreground">{c.learners.toLocaleString()} learners · {c.teachers} teachers</p></div>
              <div className="flex flex-col gap-1"><span className="flex justify-between text-xs"><span className="text-muted-foreground">In school today</span><span className="font-semibold tabular-nums">{c.attendance_today != null ? `${c.attendance_today}%` : "—"}</span></span><Bar value={c.attendance_today} label="Attendance" /></div>
              <div className="flex flex-col gap-1"><span className="flex justify-between text-xs"><span className="text-muted-foreground">Fees collected</span><span className="font-semibold tabular-nums">{c.fee_rate != null ? `${c.fee_rate}%` : "—"}</span></span><Bar value={c.fee_rate} label="Fees collected" /><span className="text-[11px] text-muted-foreground">{kes(c.outstanding)} owed</span></div>
              <div className="flex items-center gap-2 md:justify-end"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.urgent ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : c.attention ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>{c.attention ? `${c.attention} to look at` : "All clear"}</span><Button variant="ghost" size="sm" className="h-8 print:hidden" onClick={() => openSchool(c.school_id)}>Open</Button></div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card" aria-label="Decisions">
          <h2 className="border-b bg-muted/30 px-4 py-3 font-heading text-lg font-semibold sm:px-5">Decisions waiting for you</h2>
          {data.decisions.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing is waiting on you.</p> : <ul className="divide-y">{data.decisions.map((d, i) => <li key={i} className="px-4 py-3 text-sm sm:px-5"><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{d.school_name}</span>{d.title}<span className="block text-xs text-muted-foreground">{d.detail} · waiting {d.age_days} day{d.age_days === 1 ? "" : "s"}</span></li>)}</ul>}
        </section>
        <section className="overflow-hidden rounded-xl border bg-card" aria-label="Attention">
          <h2 className="border-b bg-muted/30 px-4 py-3 font-heading text-lg font-semibold sm:px-5">Needs attention</h2>
          {data.attention.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing needs attention.</p> : <ul className="divide-y">{data.attention.map((a, i) => <li key={i} className="flex gap-3 px-4 py-3 text-sm sm:px-5"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden /><span><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{a.school_name}</span>{a.text}</span></li>)}</ul>}
        </section>
      </div>

      {data.sections.map((sec) => (
        <section key={sec.key} className="overflow-hidden rounded-xl border bg-card break-inside-avoid" aria-label={sec.title}>
          <h2 className="border-b bg-muted/30 px-4 py-3 font-heading text-lg font-semibold sm:px-5">{sec.title}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead><tr className="border-b text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"><th scope="col" className="px-4 py-2.5 sm:px-5">School</th>{sec.columns.map((c) => <th key={c.key} scope="col" className="px-3 py-2.5 text-right">{c.label}</th>)}</tr></thead>
              <tbody className="divide-y">
                {sec.rows.map((r) => <tr key={r.school_id}><th scope="row" className="px-4 py-2.5 text-left font-medium sm:px-5">{r.school_name}</th>{sec.columns.map((c) => <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">{r.enabled ? formatValue(r.values[c.key], c.kind) : "—"}</td>)}</tr>)}
              </tbody>
              <tfoot><tr className="border-t-2 bg-muted/40 font-semibold"><th scope="row" className="px-4 py-2.5 text-left sm:px-5">All schools</th>{sec.columns.map((c) => <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">{formatValue(sec.group[c.key], c.kind)}</td>)}</tr></tfoot>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
