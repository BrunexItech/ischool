"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarCheck2, FileBarChart, GraduationCap, Landmark, Layers, Lightbulb, ShieldAlert, Users, Wallet } from "lucide-react";
import { api, GroupModuleInfo, GroupOverview } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Bar, GroupSkeleton, healthTone, kes, useGroupMode, useOpenSchool } from "@/components/group/GroupUi";
import { ErrorBox } from "@/components/oversight";
import { Button } from "@/components/ui/button";

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Stat({ icon: Icon, label, value, sub, warn }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={`relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-card p-4 shadow-xs ${warn ? "border-amber-300/70 dark:border-amber-700/50" : ""}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${warn ? "bg-amber-500" : "bg-primary/70"}`} aria-hidden />
      <span className={`flex size-9 items-center justify-center rounded-lg ${warn ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-primary/10 text-primary"}`}><Icon className="size-4.5" aria-hidden /></span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`font-heading text-3xl leading-none font-semibold tabular-nums ${warn ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</p>
      </div>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

/** "All Schools": the principal's home. Every school at a glance, what needs attention anywhere, and the few decisions that are theirs. */
export function GroupHome() {
  const { token, user } = useAuth();
  const { ready } = useGroupMode();
  const openSchool = useOpenSchool();
  const [data, setData] = useState<GroupOverview | null>(null);
  const [modules, setModules] = useState<GroupModuleInfo[]>([]);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token || !ready) return;
    let cancelled = false;
    Promise.all([api.getGroupOverview(token), api.listGroupModules(token)])
      .then(([o, m]) => {
        if (cancelled) return;
        setData(o);
        setModules(m);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token, ready, version]);

  if (failed) return <ErrorBox message="We couldn't load your schools just now." onRetry={() => setVersion((v) => v + 1)} />;
  if (!data) return <GroupSkeleton />;

  const first = user?.full_name.split(" ")[0];

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase"><Layers className="size-3.5" aria-hidden /> All Schools</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{greet()}, {first}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.schools.length} school{data.schools.length === 1 ? "" : "s"} · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 sm:h-9" nativeButton={false} render={<Link href="/dashboard/group/report"><FileBarChart /> Weekly report</Link>} />
          <Button className="h-10 sm:h-9" nativeButton={false} render={<Link href="/dashboard/meetings"><CalendarCheck2 /> Call a staff meeting</Link>} />
        </div>
      </header>

      {data.schools.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-14 text-center text-sm text-muted-foreground">No schools have been attached to your account yet. The platform administrator attaches the schools you oversee.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="The group at a glance">
            <Stat icon={Users} label="Learners" value={data.learners.toLocaleString()} sub={`across ${data.schools.length} schools`} />
            <Stat icon={GraduationCap} label="Teachers" value={data.teachers.toLocaleString()} sub="active teaching staff" />
            <Stat icon={Landmark} label="In school today" value={data.attendance_today != null ? `${data.attendance_today}%` : "—"} sub="learners marked present or late" warn={data.attendance_today != null && data.attendance_today < 65} />
            <Stat icon={Wallet} label="Fees collected" value={data.fee_rate != null ? `${data.fee_rate}%` : "—"} sub={`${kes(data.outstanding)} still owed`} warn={data.fee_rate != null && data.fee_rate < 65} />
            <Stat icon={ShieldAlert} label="Needs attention" value={String(data.attention_total)} sub={data.attention_total ? "things to look at in the schools" : "nothing outstanding"} warn={data.attention_total > 0} />
          </section>

          {data.spotlight.length > 0 && (
            <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="What stands out">
              <h2 className="mb-2 flex items-center gap-2 font-heading text-base font-semibold"><Lightbulb className="size-4 text-amber-500" aria-hidden /> What stands out</h2>
              <ul className="flex flex-col gap-1.5 text-sm">{data.spotlight.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden /><span>{t}</span></li>)}</ul>
            </section>
          )}

          <section aria-label="Your schools" className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold">Your schools</h2>
            <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {data.schools.map((c) => {
                const fee = healthTone(c.fee_rate);
                const a = healthTone(c.attendance_today);
                return (
                  <li key={c.school_id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-heading text-lg leading-tight font-semibold break-words">{c.name}</h3>
                        <p className="text-sm text-muted-foreground">{c.learners.toLocaleString()} learners · {c.teachers} teachers</p>
                      </div>
                      {c.attention > 0 ? (
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${c.urgent ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>{c.attention} to look at{c.urgent ? `, ${c.urgent} urgent` : ""}</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">All clear</span>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between"><span className="text-xs text-muted-foreground">In school today</span><span className={`text-sm font-semibold tabular-nums ${a.text}`}>{c.attendance_today != null ? `${c.attendance_today}%` : "No school"}</span></div>
                        <Bar value={c.attendance_today} label="Attendance today" />
                        {c.registers_total ? <span className="text-[11px] text-muted-foreground">{c.registers_taken} of {c.registers_total} registers taken</span> : null}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between"><span className="text-xs text-muted-foreground">Fees collected</span><span className={`text-sm font-semibold tabular-nums ${fee.text}`}>{c.fee_rate != null ? `${c.fee_rate}%` : "—"}</span></div>
                        <Bar value={c.fee_rate} label="Fees collected" />
                        <span className="text-[11px] text-muted-foreground">{kes(c.outstanding)} still owed</span>
                      </div>
                    </div>
                    <Button variant="outline" className="h-10 w-full justify-between sm:h-9" onClick={() => openSchool(c.school_id)}>Open {c.name} <ArrowUpRight /></Button>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <section className="overflow-hidden rounded-xl border bg-card" aria-label="Decisions waiting for you">
              <header className="border-b px-4 py-3 sm:px-5"><h2 className="font-heading text-lg font-semibold">Decisions waiting for you</h2><p className="text-sm text-muted-foreground">Only the critical ones reach you. Everything else the heads handle.</p></header>
              {data.decisions.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing is waiting on you.</p> : (
                <ul className="divide-y">
                  {data.decisions.map((d, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => openSchool(d.school_id, "/dashboard/finance")} className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5">
                        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{d.school_name}</span><span className="block text-sm font-medium break-words">{d.title}</span><span className="block text-xs text-muted-foreground">{d.detail}</span></span>
                        <span className={`shrink-0 text-xs tabular-nums ${d.age_days >= 3 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{d.age_days === 0 ? "today" : `${d.age_days} d`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border bg-card" aria-label="Needs attention">
              <header className="border-b px-4 py-3 sm:px-5"><h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><AlertTriangle className="size-4 text-amber-500" aria-hidden /> Needs attention</h2><p className="text-sm text-muted-foreground">The most pressing items across the schools, urgent first.</p></header>
              {data.attention.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">All schools are in good order.</p> : (
                <ul className="divide-y">
                  {data.attention.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden />
                      <span className="min-w-0 flex-1"><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{a.school_name}</span><span className="block text-sm break-words">{a.text}</span></span>
                      <button type="button" onClick={() => openSchool(a.school_id, a.href ?? "/dashboard")} className="shrink-0 text-xs font-medium text-primary hover:underline">Open</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-label="Compare the schools" className="flex flex-col gap-3">
            <div><h2 className="font-heading text-lg font-semibold">Compare the schools</h2><p className="text-sm text-muted-foreground">Open any area to see every school side by side.</p></div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {modules.map((m) => (
                <li key={m.key}>
                  <Link href={`/dashboard/group/${m.key}`} className="flex h-full flex-col gap-1 rounded-xl border bg-card p-3.5 outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex items-center justify-between font-medium">{m.title}<ArrowUpRight className="size-4 text-muted-foreground" aria-hidden /></span>
                    <span className="text-xs leading-snug text-muted-foreground">{m.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
