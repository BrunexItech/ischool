"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarCheck2, Crown, FileBarChart, GraduationCap, Lightbulb, ShieldAlert, Users } from "lucide-react";
import { api, GroupAttentionSummary, GroupOverview } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { compactKes, GroupLoader, healthTone, InlineWorking, Ring, schoolColor, useGroupMode, useOpenSchool } from "@/components/group/GroupUi";
import { ErrorBox } from "@/components/oversight";
import { Button } from "@/components/ui/button";

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function HeroRing({ value, label, caption }: { value: number | null; label: string; caption: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Ring value={value} size={108} stroke={10} color="#FFC857" track="#ffffff" trackOpacity={0.18} label={label}>
        <span className="font-heading text-2xl font-semibold tabular-nums">{value != null ? `${value}%` : "—"}</span>
      </Ring>
      <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-white/70">{caption}</p></div>
    </div>
  );
}

/** "All Schools": the principal's home. A banner that says how the group is doing, then each school as its own card, then what needs the principal. */
export function GroupHome() {
  const { token, user } = useAuth();
  const { ready } = useGroupMode();
  const openSchool = useOpenSchool();
  const [data, setData] = useState<GroupOverview | null>(null);
  const [attention, setAttention] = useState<GroupAttentionSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token || !ready) return;
    let cancelled = false;
    // The cards come first and fast; what needs attention takes longer and fills in when it is ready.
    api.getGroupOverview(token).then((o) => { if (!cancelled) { setData(o); setFailed(false); } }).catch(() => !cancelled && setFailed(true));
    api.getGroupAttention(token).then((a) => !cancelled && setAttention(a)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, ready, version]);

  const standings = useMemo(() => {
    const withAtt = (data?.schools ?? []).filter((c) => c.attendance_today != null).sort((a, b) => (b.attendance_today ?? 0) - (a.attendance_today ?? 0));
    return new Map(withAtt.map((c, i) => [c.school_id, i + 1]));
  }, [data]);

  if (failed) return <ErrorBox message="We couldn't load your schools just now." onRetry={() => { setData(null); setFailed(false); setVersion((v) => v + 1); }} />;
  if (!data) return <GroupLoader label="Gathering your schools..." />;

  const first = user?.full_name.split(" ")[0];
  const taken = data.schools.reduce((n, c) => n + (c.registers_taken ?? 0), 0);
  const expected = data.schools.reduce((n, c) => n + (c.registers_total ?? 0), 0);
  const registersPct = expected ? Math.round((100 * taken) / expected) : null;
  const total = attention?.total ?? null;
  const urgent = attention?.urgent ?? 0;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="relative overflow-hidden rounded-3xl p-5 text-white shadow-md sm:p-8" style={{ background: "linear-gradient(125deg, #4a0d10 0%, #8B1A1D 52%, #c0452f 100%)" }}>
        <span className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/[0.06]" aria-hidden />
        <span className="pointer-events-none absolute -bottom-28 left-10 size-64 rounded-full bg-[#FFA819]/10" aria-hidden />
        <div className="relative flex flex-col gap-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.16em] text-white/70 uppercase">All Schools</p>
              <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{greet()}, {first}</h1>
              <p className="mt-1.5 max-w-xl text-sm text-white/80">{data.schools.length} school{data.schools.length === 1 ? "" : "s"} under your care · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="h-10 bg-white text-[#8B1A1D] hover:bg-white/90" nativeButton={false} render={<Link href="/dashboard/group/report"><FileBarChart /> Weekly report</Link>} />
              <Button className="h-10 border border-white/30 bg-white/10 text-white hover:bg-white/20" nativeButton={false} render={<Link href="/dashboard/meetings"><CalendarCheck2 /> Call a staff meeting</Link>} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-6 lg:max-w-2xl"><HeroRing value={data.attendance_today} label="In school" caption="today" /><HeroRing value={data.fee_rate} label="Fees collected" caption="of what was billed" /><HeroRing value={registersPct} label="Registers" caption="taken today" /></div>

          <dl className="grid grid-cols-2 gap-3 border-t border-white/15 pt-5 sm:grid-cols-4">
            <div><dt className="flex items-center gap-1.5 text-xs text-white/70"><Users className="size-3.5" aria-hidden />Learners</dt><dd className="font-heading text-2xl font-semibold tabular-nums">{data.learners.toLocaleString()}</dd></div>
            <div><dt className="flex items-center gap-1.5 text-xs text-white/70"><GraduationCap className="size-3.5" aria-hidden />Teachers</dt><dd className="font-heading text-2xl font-semibold tabular-nums">{data.teachers.toLocaleString()}</dd></div>
            <div><dt className="text-xs text-white/70">Still owed in fees</dt><dd className="font-heading text-2xl font-semibold tabular-nums">{compactKes(data.outstanding)}</dd></div>
            <div><dt className="flex items-center gap-1.5 text-xs text-white/70"><ShieldAlert className="size-3.5" aria-hidden />Needs attention</dt><dd className="font-heading text-2xl font-semibold tabular-nums">{total === null ? <span className="inline-block size-5 animate-spin rounded-full border-2 border-white/30 border-t-white align-middle" role="status" aria-label="Working it out" /> : total}{urgent > 0 && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 align-middle text-xs font-semibold">{urgent} urgent</span>}</dd></div>
          </dl>
        </div>
      </header>

      {data.schools.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-14 text-center text-sm text-muted-foreground">No schools have been attached to your account yet. The platform administrator attaches the schools you oversee.</p>
      ) : (
        <>
          <section aria-label="What stands out" className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Lightbulb className="size-4.5 text-amber-500" aria-hidden /> What stands out</h2>{!attention && <InlineWorking label="Reading each school's week..." />}</div>
            {attention && attention.spotlight.length === 0 ? <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">Nothing stands out. Your schools are moving together.</p> : (
              <ul className="grid gap-3 md:grid-cols-3">
                {(attention?.spotlight ?? []).map((t, i) => (
                  <li key={t} className="relative overflow-hidden rounded-2xl border bg-card p-4 pl-5 shadow-xs"><span className="absolute inset-y-0 left-0 w-1.5" style={{ background: ["#0E7490", "#B45309", "#8B1A1D"][i % 3] }} aria-hidden /><p className="text-sm leading-relaxed">{t}</p></li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Your schools" className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold">Your schools</h2>
            <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {data.schools.map((c, idx) => {
                const att = attention?.per_school[String(c.school_id)];
                const rank = standings.get(c.school_id);
                const a = healthTone(c.attendance_today);
                const f = healthTone(c.fee_rate);
                return (
                  <li key={c.school_id} className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md">
                    <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: schoolColor(idx) }} aria-hidden />
                    <div className="flex items-start justify-between gap-3 pl-1.5">
                      <div className="min-w-0"><h3 className="font-heading text-lg leading-tight font-semibold break-words">{c.name}</h3><p className="text-sm text-muted-foreground">{c.learners.toLocaleString()} learners · {c.teachers} teachers</p></div>
                      {att ? (att.attention > 0 ? <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${att.urgent ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>{att.attention} to look at</span> : <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">All clear</span>) : <span className="shrink-0"><InlineWorking label="Checking" /></span>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pl-1.5">
                      <div className="flex items-center gap-3">
                        <Ring value={c.attendance_today} size={72} stroke={8} label="In school today"><span className={`text-base font-semibold tabular-nums ${a.text}`}>{c.attendance_today != null ? `${c.attendance_today}%` : "—"}</span></Ring>
                        <div className="min-w-0"><p className="text-xs font-medium">In school</p><p className="text-[11px] text-muted-foreground">{c.registers_total ? `${c.registers_taken}/${c.registers_total} registers` : "no school today"}</p>{rank === 1 && data.schools.length > 1 && <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"><Crown className="size-3" aria-hidden />Highest today</p>}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Ring value={c.fee_rate} size={72} stroke={8} label="Fees collected"><span className={`text-base font-semibold tabular-nums ${f.text}`}>{c.fee_rate != null ? `${c.fee_rate}%` : "—"}</span></Ring>
                        <div className="min-w-0"><p className="text-xs font-medium">Fees collected</p><p className="text-[11px] text-muted-foreground">{compactKes(c.outstanding)} owed</p></div>
                      </div>
                    </div>
                    <Button variant="outline" className="ml-1.5 h-10 justify-between" onClick={() => openSchool(c.school_id)}>Open {c.name}<ArrowUpRight /></Button>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Decisions waiting for you">
              <header className="border-b px-5 py-4"><h2 className="font-heading text-lg font-semibold">Decisions waiting for you</h2><p className="text-sm text-muted-foreground">Only the critical ones reach you. The heads handle the rest.</p></header>
              {data.decisions.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nothing is waiting on you.</p> : (
                <ul className="divide-y">
                  {data.decisions.map((d, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => openSchool(d.school_id, "/dashboard/finance")} className="flex w-full items-start gap-3 px-5 py-3.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40">
                        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{d.school_name}</span><span className="block text-sm font-medium break-words">{d.title}</span><span className="block text-xs text-muted-foreground">{d.detail}</span></span>
                        <span className={`shrink-0 text-xs tabular-nums ${d.age_days >= 3 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{d.age_days === 0 ? "today" : `${d.age_days} d`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Needs attention">
              <header className="flex items-start justify-between gap-3 border-b px-5 py-4"><div><h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><AlertTriangle className="size-4 text-amber-500" aria-hidden /> Needs attention</h2><p className="text-sm text-muted-foreground">The most pressing items across the schools, urgent first.</p></div></header>
              {!attention ? <div className="flex items-center justify-center px-5 py-10"><InlineWorking label="Reading each school's week..." /></div> : attention.items.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">All schools are in good order.</p> : (
                <ul className="divide-y">
                  {attention.items.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden />
                      <span className="min-w-0 flex-1"><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{a.school_name}</span><span className="block text-sm break-words">{a.text}</span></span>
                      <button type="button" onClick={() => openSchool(a.school_id, a.href ?? "/dashboard")} className="shrink-0 text-xs font-medium text-primary hover:underline">Open</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

