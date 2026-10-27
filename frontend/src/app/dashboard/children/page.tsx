"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { setActiveChildId, useFamily } from "@/lib/family";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Ring, healthTone } from "@/components/group/GroupUi";
import { ChildAvatar, Empty, Section, money } from "@/components/family/FamilyUi";

export default function MyChildrenPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { cards, list } = useFamily();

  useEffect(() => {
    if (!loading && user && user.role !== "parent") router.replace("/dashboard");
  }, [loading, user, router]);

  if (cards === undefined) return <PageLoader label="Finding your children..." />;

  return (
    <div className="flex flex-col gap-6">
      <Section title="My Children" hint="Choose a child to see their timetable, attendance, results, fees and more.">
        {list.length === 0 ? (
          <Empty icon={<GraduationCap />} title="No children are linked to your account yet">Please ask the school office to link your children to this account.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((c, i) => {
              const s = c.student;
              const a = c.attendance;
              return (
                <div key={s.id} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
                  <div className="flex items-center gap-3">
                    <ChildAvatar first={s.first_name} last={s.last_name} index={i} size={56} />
                    <div className="min-w-0">
                      <p className="truncate font-heading text-lg font-semibold">{s.first_name} {s.last_name}</p>
                      <p className="truncate text-sm text-muted-foreground">{s.class_name ?? "No class yet"} · Adm. {s.admission_number}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 py-3">
                      <Ring value={a?.rate ?? null} size={48} stroke={6} label="Attendance"><span className={`text-[11px] font-semibold ${healthTone(a?.rate).text}`}>{a?.rate != null ? `${a.rate}%` : "—"}</span></Ring>
                      <dt className="text-[11px] text-muted-foreground">Attendance</dt>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-muted/40 py-3"><dd className="font-heading text-base font-semibold tabular-nums">{c.fees ? (c.fees.balance > 0 ? money(c.fees.balance).replace("KES ", "") : "Paid") : "—"}</dd><dt className="text-[11px] text-muted-foreground">Fees due</dt></div>
                    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-muted/40 py-3"><dd className="font-heading text-base font-semibold tabular-nums">{c.homework?.open ?? "—"}</dd><dt className="text-[11px] text-muted-foreground">Homework</dt></div>
                  </dl>
                  <Button className="h-11 gap-1.5" render={<Link href={`/dashboard/children/${s.id}`} onClick={() => setActiveChildId(s.id)}>Open {s.first_name}&apos;s record <ArrowRight /></Link>} nativeButton={false} />
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
