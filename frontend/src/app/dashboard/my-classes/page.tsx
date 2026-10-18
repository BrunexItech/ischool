"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, CheckCircle2, ClipboardCheck, Clock, GraduationCap, Users } from "lucide-react";
import { api, MyClass, MyTimetableSlot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MyClassesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [timetable, setTimetable] = useState<MyTimetableSlot[]>([]);
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

  if (loading || dataLoading) return <PageLoader />;

  const homeroomCount = classes.filter((c) => c.is_homeroom_teacher).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Classes"
        description={
          classes.length === 0
            ? "You haven't been assigned to any classes yet — ask your school admin to set this up."
            : `${classes.length} class${classes.length > 1 ? "es" : ""}${homeroomCount ? ` · homeroom teacher for ${homeroomCount}` : ""}`
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <Card key={`${c.class_id}-${c.subject_id ?? "home"}`} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-4 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {c.subject_id ? <BookOpen className="size-4.5" /> : <GraduationCap className="size-4.5" />}
                </div>
                {c.is_homeroom_teacher && <Badge className="gap-1"><GraduationCap className="size-3" /> Homeroom</Badge>}
              </div>

              <div>
                <p className="font-heading text-base font-semibold">{c.class_name}</p>
                <p className="text-sm text-muted-foreground">{c.subject_name ?? "All subjects · attendance"}</p>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {c.student_count} learners</span>
                <span className="flex items-center gap-1.5">
                  {c.attendance_marked_today ? (
                    <><CheckCircle2 className="size-3.5 text-emerald-600" /> Register marked</>
                  ) : (
                    <><ClipboardCheck className="size-3.5 text-amber-600" /> Register pending</>
                  )}
                </span>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <Link href={`/dashboard/attendance?class_id=${c.class_id}`}>
                  <Button size="sm" variant="outline"><ClipboardCheck /> Attendance</Button>
                </Link>
                <Link href="/dashboard/results">
                  <Button size="sm" variant="outline">Results</Button>
                </Link>
                <Link href="/dashboard/students">
                  <Button size="sm" variant="ghost">Roster</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
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
