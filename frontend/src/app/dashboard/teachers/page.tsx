"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Home, BookOpen } from "lucide-react";
import { api, SchoolClass, Staff, Subject, TeacherAssignment } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function TeachersPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin" && user.role !== "supervisor") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listStaff(token, user.school_id).then(setStaff).catch(() => setStaff([])),
      api.listTeacherAssignments(token, user.school_id).then(setAssignments).catch(() => setAssignments([])),
      api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([])),
      api.listSubjects(token, user.school_id).then(setSubjects).catch(() => setSubjects([])),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  const teachers = useMemo(() => staff.filter((s) => s.role === "teacher"), [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.staff_number.toLowerCase().includes(q) ||
        (t.department ?? "").toLowerCase().includes(q)
    );
  }, [teachers, search]);

  function homeroomClasses(teacherId: number) {
    return classes.filter((c) => c.homeroom_teacher_id === teacherId);
  }

  function teachingAssignments(teacherId: number) {
    return assignments.filter((a) => a.teacher_user_id === teacherId);
  }

  function className(id: number) {
    return classes.find((c) => c.id === id)?.name ?? `#${id}`;
  }

  function subjectName(id: number | null) {
    if (id === null) return null;
    return subjects.find((s) => s.id === id)?.name ?? `#${id}`;
  }

  if (loading || dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Teachers" description="Every teacher at this school and what they're assigned to." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teachers"
        description={`${teachers.length} teacher${teachers.length === 1 ? "" : "s"} at this school — homeroom duties, subjects and classes, in one directory.`}
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, staff #, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => {
          const homerooms = homeroomClasses(t.user_id);
          const teaching = teachingAssignments(t.user_id);
          return (
            <Card key={t.id}>
              <CardContent className="flex flex-col gap-3 pt-6">
                <div>
                  <p className="font-heading font-semibold">{t.full_name}</p>
                  <p className="text-xs text-muted-foreground">{t.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.staff_number} {t.department ? `· ${t.department}` : ""}
                  </p>
                </div>

                {homerooms.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Home className="size-3.5 text-primary" />
                    {homerooms.map((c) => (
                      <Badge key={c.id} variant="default">{c.name} · class teacher</Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-start gap-1.5">
                  <BookOpen className="mt-0.5 size-3.5 text-muted-foreground" />
                  {teaching.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No teaching assignments yet</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {teaching.map((a) => (
                        <Badge key={a.id} variant="secondary">
                          {className(a.class_id)}{subjectName(a.subject_id) ? ` · ${subjectName(a.subject_id)}` : ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {teachers.length === 0 ? "No teachers added yet — add one from the Staff page." : "No teachers match your search."}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-2">
        <Link href="/dashboard/teacher-assignments"><Button variant="outline" size="sm">Manage class & subject assignments</Button></Link>
        <Link href="/dashboard/staff"><Button variant="outline" size="sm">Add a teacher</Button></Link>
      </div>
    </div>
  );
}
