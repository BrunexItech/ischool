"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Printer } from "lucide-react";
import { api, ApiError, GroupAttentionSummary, GroupComparison, GroupOverview } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { compactKes, formatValue, GroupLoader, healthTone, InlineWorking, Ring, schoolColor, useGroupMode, useOpenSchool } from "@/components/group/GroupUi";
import { MODULE_ICON, PRIMARY } from "@/components/group/GroupModuleCards";
import { ErrorBox } from "@/components/oversight";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

const SECTIONS = ["attendance", "staff", "lessons", "homework", "results", "conduct", "fees", "finance"];

/** One area of the report: the figure that matters most, drawn as bars so the schools can be read against each other. */
function SectionCard({ cmp }: { cmp: GroupComparison }) {
  const primary = PRIMARY[cmp.key];
  const col = cmp.columns.find((c) => c.key === primary?.key) ?? cmp.columns[0];
  const Icon = MODULE_ICON[cmp.key];
  const values = cmp.rows.map((r) => (r.enabled ? r.values[col.key] : null));
  const max = col.kind === "percent" || col.kind === "score" ? 100 : Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 break-inside-avoid shadow-xs" aria-label={cmp.title}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>}
          <div className="min-w-0"><h2 className="font-heading text-base leading-tight font-semibold">{cmp.title}</h2><p className="text-xs text-muted-foreground">{col.label}</p></div>
        </div>
        <div className="text-right"><p className="font-heading text-2xl leading-none font-semibold tabular-nums">{col.kind === "money" && cmp.group[col.key] != null ? `${(cmp.group[col.key] as number) < 0 ? "−" : ""}${compactKes(Math.abs(cmp.group[col.key] as number))}` : formatValue(cmp.group[col.key], col.kind)}</p><p className="mt-1 text-[11px] text-muted-foreground">all schools</p></div>
      </header>
      <ul className="flex flex-col gap-3">
        {cmp.rows.map((r, i) => {
          const v = r.enabled ? r.values[col.key] : null;
          const tone = col.kind === "percent" ? healthTone(v) : null;
          return (
            <li key={r.school_id} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: schoolColor(i) }} aria-hidden /><span className="truncate">{r.school_name}</span></span>
              <span className="block h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full transition-all duration-700" style={{ width: `${v == null ? 0 : Math.min(100, (v / max) * 100)}%`, background: tone?.hex ?? schoolColor(i) }} /></span>
              <span className="w-24 text-right font-semibold whitespace-nowrap tabular-nums">{r.enabled ? (col.kind === "money" && v != null ? `${v < 0 ? "−" : ""}${compactKes(Math.abs(v))}` : formatValue(v, col.kind)) : "—"}</span>
            </li>
          );
        })}
      </ul>
      {cmp.columns.length > 1 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 sm:grid-cols-3">
          {cmp.columns.filter((c) => c.key !== col.key).slice(0, 3).map((c) => <div key={c.key}><dt className="text-[11px] text-muted-foreground">{c.label}</dt><dd className="text-sm font-semibold tabular-nums">{formatValue(cmp.group[c.key], c.kind)}</dd></div>)}
        </dl>
      )}
    </section>
  );
}

/** The principal's weekly report: the same picture that is emailed on Saturday morning, always here. It opens at once and fills in as each part is ready. */
export function GroupReportView() {
  const { token } = useAuth();
  const { ready } = useGroupMode();
  const openSchool = useOpenSchool();
  const [overview, setOverview] = useState<GroupOverview | null>(null);
  const [attention, setAttention] = useState<GroupAttentionSummary | null>(null);
  const [sections, setSections] = useState<Record<string, GroupComparison>>({});
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    if (!token || !ready) return;
    let cancelled = false;
    api.getGroupOverview(token).then((o) => { if (!cancelled) { setOverview(o); setFailed(false); } }).catch(() => !cancelled && setFailed(true));
    api.getGroupAttention(token).then((a) => !cancelled && setAttention(a)).catch(() => undefined);
    for (const key of SECTIONS) api.getGroupComparison(token, key).then((c) => !cancelled && setSections((s) => ({ ...s, [key]: c }))).catch(() => undefined);
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

  if (failed) return <ErrorBox message="We couldn't build the report just now." onRetry={() => { setOverview(null); setAttention(null); setSections({}); setFailed(false); setVersion((v) => v + 1); }} />;
  if (!overview) return <GroupLoader label="Preparing your weekly report..." />;

  const range = overview.week_start && overview.week_end ? `${new Date(overview.week_start + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${new Date(overview.week_end + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "";
  const count = overview.schools.length;
  const headline = attention === null ? null : attention.total === 0 ? `A quiet week across your ${count} school${count === 1 ? "" : "s"}: nothing needs your attention.` : `${attention.total} thing${attention.total === 1 ? "" : "s"} need${attention.total === 1 ? "s" : ""} attention across your ${count} school${count === 1 ? "" : "s"}${attention.urgent ? `, ${attention.urgent} of them urgent.` : "."}`;
  const pending = SECTIONS.filter((k) => !sections[k]).length;

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <header className="relative overflow-hidden rounded-3xl p-5 text-white shadow-md sm:p-8" style={{ background: "linear-gradient(125deg, #4a0d10 0%, #8B1A1D 60%, #C2410C 130%)" }}>
        <span className="pointer-events-none absolute -top-20 -right-12 size-64 rounded-full bg-white/[0.06]" aria-hidden />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.16em] text-white/70 uppercase">Weekly report · All Schools</p>
              <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">Your schools this week</h1>
              <p className="mt-1.5 text-sm text-white/75">Week of {range}. Emailed to you every Saturday morning.</p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button className="h-10 border border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={email} disabled={emailing}>{emailing ? <Spinner size={16} className="text-current" /> : <Mail />} Email it to me</Button>
              <Button className="h-10 bg-white text-[#7F1D1D] hover:bg-white/90" onClick={() => window.print()}><Printer /> Print or save as PDF</Button>
            </div>
          </div>
          <p className="min-h-12 rounded-xl border-l-4 border-[#FFC857] bg-white/10 px-4 py-3 text-[0.95rem] leading-snug font-semibold">{headline ?? <InlineWorking label="Reading each school's week..." />}</p>
        </div>
      </header>

      <section aria-label="Schools" className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Your schools</h2>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overview.schools.map((c, i) => {
            const att = attention?.per_school[String(c.school_id)];
            return (
              <li key={c.school_id} className="relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-4 pl-5 break-inside-avoid shadow-xs">
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: schoolColor(i) }} aria-hidden />
                <Ring value={c.attendance_today} size={64} stroke={7} label="In school today"><span className="text-sm font-semibold tabular-nums">{c.attendance_today != null ? `${c.attendance_today}%` : "—"}</span></Ring>
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.learners.toLocaleString()} learners · fees {c.fee_rate != null ? `${c.fee_rate}%` : "—"} · {compactKes(c.outstanding)} owed</p>
                  <p className={`mt-1 text-xs font-semibold ${att ? (att.urgent ? "text-red-700 dark:text-red-400" : att.attention ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400") : ""}`}>{att ? (att.attention ? `${att.attention} to look at${att.urgent ? `, ${att.urgent} urgent` : ""}` : "All clear") : <InlineWorking label="Checking" />}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 print:hidden" onClick={() => openSchool(c.school_id)}>Open</Button>
              </li>
            );
          })}
        </ul>
      </section>

      {attention && attention.spotlight.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-3">{attention.spotlight.map((t, i) => <li key={t} className="relative overflow-hidden rounded-2xl border bg-card p-4 pl-5 text-sm leading-relaxed break-inside-avoid shadow-xs"><span className="absolute inset-y-0 left-0 w-1.5" style={{ background: ["#0E7490", "#B45309", "#8B1A1D"][i % 3] }} aria-hidden />{t}</li>)}</ul>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border bg-card break-inside-avoid" aria-label="Decisions">
          <h2 className="border-b bg-muted/30 px-5 py-3.5 font-heading text-lg font-semibold">Decisions waiting for you</h2>
          {overview.decisions.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing is waiting on you.</p> : <ul className="divide-y">{overview.decisions.map((d, i) => <li key={i} className="px-5 py-3 text-sm"><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{d.school_name}</span>{d.title}<span className="block text-xs text-muted-foreground">{d.detail} · waiting {d.age_days} day{d.age_days === 1 ? "" : "s"}</span></li>)}</ul>}
        </section>
        <section className="overflow-hidden rounded-2xl border bg-card break-inside-avoid" aria-label="Attention">
          <h2 className="border-b bg-muted/30 px-5 py-3.5 font-heading text-lg font-semibold">Needs attention</h2>
          {!attention ? <div className="flex justify-center px-5 py-8"><InlineWorking label="Reading each school's week..." /></div> : attention.items.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing needs attention.</p> : <ul className="divide-y">{attention.items.map((a, i) => <li key={i} className="flex gap-3 px-5 py-3 text-sm"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden /><span><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{a.school_name}</span>{a.text}</span></li>)}</ul>}
        </section>
      </div>

      <section aria-label="How the schools compare" className="flex flex-col gap-3">
        <div className="flex items-center justify-between"><h2 className="font-heading text-lg font-semibold">How the schools compare</h2>{pending > 0 && <InlineWorking label={`Working out ${pending} more...`} />}</div>
        <div className="grid gap-4 lg:grid-cols-2">{SECTIONS.map((k) => sections[k] ? <SectionCard key={k} cmp={sections[k]} /> : null)}</div>
      </section>
    </div>
  );
}
