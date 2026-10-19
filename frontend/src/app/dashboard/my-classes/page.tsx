"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, CheckCircle2, ChevronDown, ClipboardCheck, Clock, GraduationCap, Search, Users } from "lucide-react";
import { api, MyClass, MyTimetableSlot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ClassCard({ c }: { c: MyClass }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {c.is_homeroom_teacher ? <GraduationCap className="size-4.5" /> : <BookOpen className="size-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-heading text-sm font-semibold">{c.class_name}</p>
            {c.is_homeroom_teacher && <Badge className="gap-1 shrink-0"><GraduationCap className="size-3" /> Class teacher</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {c.subjects.length > 0 ? c.subjects.map((s) => s.subject_name).join(", ") : "Homeroom"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {c.can_mark_attendance && (
            c.attendance_marked_today ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <ClipboardCheck className="size-4 text-amber-600" />
            )
          )}
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <CardContent className="flex flex-col gap-3 border-t pt-3 pb-4">
          {c.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.subjects.map((s) => <Badge key={s.subject_id} variant="secondary">{s.subject_name}</Badge>)}
            </div>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {c.student_count} learners</span>
            {c.can_mark_attendance && (
              <span className="flex items-center gap-1.5">
                {c.attendance_marked_today ? (
                  <><CheckCircle2 className="size-3.5 text-emerald-600" /> Register marked</>
                ) : (
                  <><ClipboardCheck className="size-3.5 text-amber-600" /> Register pending</>
                )}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {c.can_mark_attendance && (
              <Link href={`/dashboard/attendance?class_id=${c.class_id}`}>
                <Button size="sm" variant="outline"><ClipboardCheck /> Attendance</Button>
              </Link>
            )}
            <Link href="/dashboard/results">
              <Button size="sm" variant="outline">Results</Button>
            </Link>
            <Link href="/dashboard/students">
              <Button size="sm" variant="ghost">Roster</Button>
            </Link>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function MyClassesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [timetable, setTimetable] = useState<MyTimetableSlot[]>([]);
  const [search, setSearch] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && user.role !== "teacher") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listMyClasses(token, user.school_id).then(setClasses).catch(() => setClasses([])),
      api.listMyTimetable(token, user.school_id).then(setTimetable).catch(() => setTimetable([])),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  const homeroomCount = classes.filter((c) => c.is_homeroom_teacher).length;

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? classes.filter(
          (c) => c.class_name.toLowerCase().includes(q) || c.subjects.some((s) => s.subject_name.toLowerCase().includes(q))
        )
      : classes;
    return [...filtered].sort((a, b) => {
      if (a.is_homeroom_teacher !== b.is_homeroom_teacher) return a.is_homeroom_teacher ? -1 : 1;
      return a.class_name.localeCompare(b.class_name);
    });
  }, [classes, search]);

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Classes"
        description={
          classes.length === 0
            ? "You haven't been assigned to any classes yet — ask your school admin to set this up."
            : `${classes.length} class${classes.length > 1 ? "es" : ""}${homeroomCount ? ` · class teacher for ${homeroomCount}` : ""}`
        }
      />

      {classes.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by class or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c) => (
          <ClassCard key={c.class_id} c={c} />
        ))}
      </div>

      {classes.length === 0 && !dataLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <GraduationCap className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No classes assigned to you yet.</p>
          </CardContent>
        </Card>
      )}

      {classes.length > 0 && sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No classes match your search.</p>
      )}

      {timetable.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="size-4.5" /> My timetable this week</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {DAYS.map((day, i) => {
                const slots = timetable.filter((s) => s.day_of_week === i).sort((a, b) => a.start_time.localeCompare(b.start_time));
                return (
                  <div key={day} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day}</p>
                    {slots.map((s) => (
                      <div key={s.id} className="rounded-lg border p-2.5 text-xs">
                        <p className="font-medium">{s.subject_name}</p>
                        <p className="text-muted-foreground">{s.class_name} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</p>
                      </div>
                    ))}
                    {slots.length === 0 && <p className="text-xs text-muted-foreground">Free</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
