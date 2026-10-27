"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, BookOpenCheck, CheckCircle2, Clock, CreditCard, GraduationCap, School, UserCheck, UserX } from "lucide-react";
import { FamilyChildCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { setActiveChildId, recordPath, useFamily } from "@/lib/family";
import { PageLoader } from "@/components/Spinner";
import { SchoolFeed } from "@/components/family/SchoolFeed";
import { Button } from "@/components/ui/button";
import { Ring, healthTone } from "@/components/group/GroupUi";
import { ChildAvatar, Empty, Panel, Pill, Section, longDay, money } from "@/components/family/FamilyUi";

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** What needs the family's attention, most pressing first. */
function attentionFor(c: FamilyChildCard, role: string | undefined): { key: string; tone: "bad" | "warn" | "info"; text: string; href: string; cta: string }[] {
  const who = role === "student" ? "You have" : `${c.student.first_name} has`;
  const out: { key: string; tone: "bad" | "warn" | "info"; text: string; href: string; cta: string }[] = [];
  const path = (tab: string) => recordPath(role, c.student.id, tab);
  if (c.attendance?.today === "absent") out.push({ key: `abs${c.student.id}`, tone: "bad", text: role === "student" ? "You were marked absent today" : `${c.student.first_name} was marked absent today`, href: path("attendance"), cta: "See attendance" });
  if (c.homework && c.homework.overdue > 0) out.push({ key: `hwo${c.student.id}`, tone: "bad", text: `${who} ${c.homework.overdue} homework ${c.homework.overdue === 1 ? "task" : "tasks"} that ${c.homework.overdue === 1 ? "is" : "are"} late`, href: path("homework"), cta: "Open homework" });
  if (c.fees && c.fees.balance > 0) out.push({ key: `fee${c.student.id}`, tone: "warn", text: `${role === "student" ? "Your" : `${c.student.first_name}'s`} fee balance is ${money(c.fees.balance)}`, href: path("fees"), cta: "View and pay" });
  if (c.homework && c.homework.open - c.homework.overdue > 0) out.push({ key: `hw${c.student.id}`, tone: "info", text: `${role === "student" ? "You have" : `${c.student.first_name} has`} ${c.homework.open - c.homework.overdue} homework ${c.homework.open - c.homework.overdue === 1 ? "task" : "tasks"} still to hand in`, href: path("homework"), cta: "Open homework" });
  return out;
}

function ChildCard({ card, index, role, onPick }: { card: FamilyChildCard; index: number; role: string | undefined; onPick: () => void }) {
  const s = card.student;
  const a = card.attendance;
  const tone = healthTone(a?.rate);
  const todayState = a?.today;
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-3">
        <ChildAvatar first={s.first_name} last={s.last_name} index={index} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-lg leading-tight font-semibold">{s.first_name} {s.last_name}</p>
          <p className="truncate text-sm text-muted-foreground">{s.class_name ?? "No class yet"} · Adm. {s.admission_number}</p>
        </div>
        {todayState && (
          <Pill tone={todayState === "present" ? "good" : todayState === "late" ? "warn" : todayState === "absent" ? "bad" : "info"}>
            {todayState === "present" ? <UserCheck className="size-3" /> : <UserX className="size-3" />} {todayState === "present" ? "In school" : todayState}
          </Pill>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 px-1 py-3">
          <Ring value={a?.rate ?? null} size={52} stroke={6} label="Attendance, last 30 days">
            <span className={`text-xs font-semibold ${tone.text}`}>{a?.rate != null ? `${a.rate}%` : "—"}</span>
          </Ring>
          <span className="text-[11px] text-muted-foreground">Attendance</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-muted/40 px-1 py-3">
          <span className={`font-heading text-lg font-semibold tabular-nums ${card.fees && card.fees.balance > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {card.fees ? (card.fees.balance > 0 ? money(card.fees.balance).replace("KES ", "") : "Paid") : "—"}
          </span>
          <span className="text-[11px] text-muted-foreground">{card.fees && card.fees.balance > 0 ? "Fees due (KES)" : "Fees"}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-muted/40 px-1 py-3">
          <span className={`font-heading text-lg font-semibold tabular-nums ${card.homework && card.homework.overdue > 0 ? "text-red-600" : ""}`}>{card.homework ? card.homework.open : "—"}</span>
          <span className="text-[11px] text-muted-foreground">Homework to do</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="h-11 w-full basis-full gap-1.5" render={<Link href={recordPath(role, s.id)} onClick={onPick}>See {s.first_name}&apos;s page <ArrowRight /></Link>} nativeButton={false} />
        <Button variant="outline" className="h-10 flex-1" render={<Link href={recordPath(role, s.id, "timetable")} onClick={onPick}>Timetable</Link>} nativeButton={false} />
        <Button variant="outline" className="h-10 flex-1" render={<Link href={recordPath(role, s.id, "fees")} onClick={onPick}>Fees</Link>} nativeButton={false} />
      </div>
    </div>
  );
}

export function FamilyHome() {
  const { user } = useAuth();
  const { cards, list, active } = useFamily();
  const [now] = useState(() => new Date());
  const schoolId = active?.student.school_id ?? user?.school_id ?? null;

  const role = user?.role;
  const attention = useMemo(() => list.flatMap((c) => attentionFor(c, role)), [list, role]);
  const rank = { bad: 0, warn: 1, info: 2 } as const;
  const sorted = [...attention].sort((a, b) => rank[a.tone] - rank[b.tone]);

  if (!user) return null;
  if (cards === undefined) return <PageLoader label="Getting your school day ready..." />;
  if (cards === null || list.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Empty icon={<GraduationCap />} title={role === "student" ? "No student record is linked to your account yet" : "No children are linked to your account yet"}>
          {role === "student" ? "Please ask the school office to link your learner record." : "Please ask the school office to link your children to this account."}
        </Empty>
      </div>
    );
  }

  const first = user.full_name.split(" ")[0];
  const lessons = active?.lessons ?? [];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const sameDay = active ? active.today === now.toLocaleDateString("en-CA") : true;

  return (
    <div className="flex flex-col gap-7">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5e1012] via-[#A71C20] to-[#D9531E] p-5 text-white shadow-md sm:p-8">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-black/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.14em] text-white/75 uppercase">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{greeting(now.getHours())}, {first}</h1>
            <p className="mt-1 text-sm text-white/85">
              {role === "student" ? `${active?.student.class_name ?? "Your class"} · Admission ${active?.student.admission_number}` : `${list.length} ${list.length === 1 ? "child" : "children"} at school${list.length > 1 ? ` · ${list.map((c) => c.student.first_name).join(", ")}` : ` · ${active?.student.first_name} ${active?.student.last_name}`}`}
            </p>
          </div>
        </div>
      </div>

      <Section title="Needs your attention" hint={sorted.length ? "The things worth doing first." : undefined}>
        {sorted.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="size-5 shrink-0" />
            <p className="text-sm font-medium">You are all caught up. Nothing needs your attention right now.</p>
          </div>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {sorted.map((a) => (
              <Link key={a.key} href={a.href} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3.5 transition-colors hover:bg-accent/50 ${a.tone === "bad" ? "border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10" : a.tone === "warn" ? "border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10" : "bg-card"}`}>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${a.tone === "bad" ? "bg-red-100 text-red-700" : a.tone === "warn" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-700"}`}>
                  {a.tone === "info" ? <BookOpenCheck className="size-4.5" /> : a.key.startsWith("fee") ? <CreditCard className="size-4.5" /> : <AlertCircle className="size-4.5" />}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">{a.text}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">{a.cta} <ArrowRight className="size-3.5" /></span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {role !== "student" && (
      <Section title={list.length > 1 ? "Your children" : "Your child"}>
        <div className={`grid gap-4 ${list.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {list.map((c, i) => (
            <ChildCard key={c.student.id} card={c} index={i} role={role} onPick={() => setActiveChildId(c.student.id)} />
          ))}
        </div>
      </Section>
      )}

      {role === "student" && (
        <Section
          title={active ? (role === "student" ? "Today at school" : `Today at school · ${active.student.first_name}`) : "Today at school"}
          hint={active ? longDay(active.today) : undefined}
          action={active && <Button variant="outline" size="sm" className="h-9" render={<Link href={recordPath(role, active.student.id, "timetable")}>Full timetable</Link>} nativeButton={false} />}
        >
          <Panel>
            {lessons.length === 0 ? (
              <Empty icon={<School />} title="No lessons today">There is nothing on the timetable for today. Enjoy the day.</Empty>
            ) : (
              <ol className="flex flex-col">
                {lessons.map((l, i) => {
                  const live = sameDay && nowMinutes >= mins(l.start) && nowMinutes < mins(l.end);
                  const done = sameDay && nowMinutes >= mins(l.end);
                  return (
                    <li key={`${l.start}-${i}`} className="flex items-stretch gap-3">
                      <div className="flex w-14 shrink-0 flex-col items-end pt-3 text-xs tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">{l.start}</span>
                        <span>{l.end}</span>
                      </div>
                      <div className="relative flex flex-col items-center" aria-hidden>
                        <span className={`mt-4 size-2.5 rounded-full ${live ? "bg-primary ring-4 ring-primary/20" : done ? "bg-muted-foreground/40" : "bg-primary/50"}`} />
                        {i < lessons.length - 1 && <span className="w-px flex-1 bg-border" />}
                      </div>
                      <div className={`mb-2 min-w-0 flex-1 rounded-xl border p-3 ${live ? "border-primary/40 bg-primary/5" : done ? "opacity-60" : ""}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{l.subject}</p>
                          {live && <Pill tone="info"><Clock className="size-3" /> On now</Pill>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{l.teacher ?? "Teacher to be confirmed"}{l.room ? ` · ${l.room}` : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </Section>

      )}

      <SchoolFeed schoolId={schoolId} today={active?.today ?? ""} />
    </div>
  );
}
