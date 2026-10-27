"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, Plus, Trash2 } from "lucide-react";
import { api, ApiError, ClassTeacherRow, SchoolClass, Staff, Subject, TeacherAssignment } from "@/lib/api";
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
  const [classTeachers, setClassTeachers] = useState<ClassTeacherRow[]>([]);
  const [confirmSwap, setConfirmSwap] = useState<{ classId: number; teacherId: number; message: string } | null>(null);

  useEffect(() => {
    if (!loading && user && user.role !== "head_of_institution" && user.role !== "group_principal" && user.role !== "secretary") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listTeacherAssignments(token, user.school_id).then(setAssignments),
      api.listStaff(token, user.school_id).then((s) => setTeachers(s.filter((x) => x.role === "teacher"))),
      api.listClasses(token, user.school_id).then(setClasses),
      api.listSubjects(token, user.school_id).then(setSubjects),
      api.listClassTeachers(token, user.school_id).then(setClassTeachers).catch(() => setClassTeachers([])),
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

  async function setClassTeacher(classId: number, teacherId: number | null, replace = false) {
    if (!token || !user?.school_id) return;
    try {
      const row = await api.setClassTeacher(token, user.school_id, classId, teacherId, replace);
      setClassTeachers((rows) => rows.map((r) => (r.class_id === classId ? row : r)));
      setConfirmSwap(null);
      toast.success(teacherId === null ? "Class teacher removed" : `${row.teacher_name} is now the class teacher of ${row.class_name}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && teacherId !== null && err.message.includes("Confirm to replace")) {
        setConfirmSwap({ classId, teacherId, message: err.message });
      } else {
        toast.error(err instanceof ApiError ? err.message : "We couldn't change the class teacher.");
      }
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
        <CardContent className="flex flex-col gap-4 pt-6">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Crown className="size-4.5 text-primary" aria-hidden /> Class teachers</h2>
            <p className="text-sm text-muted-foreground">Each class has exactly one class teacher. They take the register, write the report-card remark and see the class results board.</p>
          </div>
          {confirmSwap && (
            <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-700/50 dark:bg-amber-950/30">
              <span>{confirmSwap.message}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirmSwap(null)}>Keep current</Button>
                <Button size="sm" onClick={() => setClassTeacher(confirmSwap.classId, confirmSwap.teacherId, true)}>Replace</Button>
              </span>
            </div>
          )}
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {classTeachers.map((c) => (
              <li key={c.class_id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium break-words">{c.class_name}</span>
                  <span className={`block text-xs ${c.teacher_name ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>{c.teacher_name ?? "No class teacher yet"}</span>
                </span>
                <Select value={c.teacher_user_id ? String(c.teacher_user_id) : ""} onValueChange={(v) => v && setClassTeacher(c.class_id, v === "none" ? null : Number(v))}>
                  <SelectTrigger className="h-9 w-40" aria-label={`Class teacher for ${c.class_name}`}><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>
                    {c.teacher_user_id && <SelectItem value="none">Remove class teacher</SelectItem>}
                    {teachers.map((t) => <SelectItem key={t.user_id} value={String(t.user_id)}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </li>
            ))}
            {classTeachers.length === 0 && <li className="text-sm text-muted-foreground">No classes yet.</li>}
          </ul>
        </CardContent>
      </Card>

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
