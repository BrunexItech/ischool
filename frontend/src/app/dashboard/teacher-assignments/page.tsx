"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError, SchoolClass, Staff, Subject, TeacherAssignment } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ANY_SUBJECT = "any";

export default function TeacherAssignmentsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState(ANY_SUBJECT);
  const [submitting, setSubmitting] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listTeacherAssignments(token, user.school_id).then(setAssignments),
      api.listStaff(token, user.school_id).then((s) => setTeachers(s.filter((x) => x.role === "teacher"))),
      api.listClasses(token, user.school_id).then(setClasses),
      api.listSubjects(token, user.school_id).then(setSubjects),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  function teacherName(id: number) {
    return teachers.find((t) => t.user_id === id)?.full_name ?? `#${id}`;
  }
  function className(id: number) {
    return classes.find((c) => c.id === id)?.name ?? `#${id}`;
  }
  function subjectName(id: number | null) {
    if (id === null) return "Attendance only";
    return subjects.find((s) => s.id === id)?.name ?? `#${id}`;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.createTeacherAssignment(token, user.school_id, {
        teacher_user_id: Number(teacherId),
        class_id: Number(classId),
        subject_id: subjectId === ANY_SUBJECT ? undefined : Number(subjectId),
      });
      setAssignments((a) => [...a, created]);
      toast.success("Assignment added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add assignment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteTeacherAssignment(token, user.school_id, id);
      setAssignments((a) => a.filter((x) => x.id !== id));
      toast.success("Assignment removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove assignment");
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Teaching Assignments"
          description="Control which classes and subjects each teacher can mark attendance for or grade."
        />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teaching Assignments"
        description="Control which classes and subjects each teacher can mark attendance for or grade."
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <Select required value={teacherId} onValueChange={(v) => v && setTeacherId(v)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Teacher" /></SelectTrigger>
              <SelectContent>
                {teachers.map((t) => <SelectItem key={t.user_id} value={String(t.user_id)}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select required value={classId} onValueChange={(v) => v && setClassId(v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subjectId} onValueChange={(v) => v && setSubjectId(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_SUBJECT}>Attendance only (no subject)</SelectItem>
                {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={submitting}>
              <Plus /> {submitting ? "Adding..." : "Add assignment"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{teacherName(a.teacher_user_id)}</TableCell>
                <TableCell><Badge variant="secondary">{className(a.class_id)}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{subjectName(a.subject_id)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleDelete(a.id)}>
                    <Trash2 /> Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {assignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No assignments yet — until you add one, teachers can&apos;t mark attendance or grade anything.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
