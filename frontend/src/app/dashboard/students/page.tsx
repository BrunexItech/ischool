"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, SchoolClass, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus } from "lucide-react";

export default function StudentsPage() {
  const { user, token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [form, setForm] = useState({
    admission_number: "",
    first_name: "",
    last_name: "",
    class_id: "",
    guardian_name: "",
    guardian_phone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canEnroll = user?.role === "school_admin" || user?.role === "staff" || user?.role === "super_admin";

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listStudents(token, user.school_id).then(setStudents).catch(() => setStudents([]));
    api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([]));
  }, [token, user?.school_id]);

  function classNameFor(classId: number | null) {
    if (!classId) return null;
    return classes.find((c) => c.id === classId)?.name ?? `#${classId}`;
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.createStudent(token, user.school_id, {
        admission_number: form.admission_number,
        first_name: form.first_name,
        last_name: form.last_name,
        class_id: form.class_id ? Number(form.class_id) : undefined,
        guardian_name: form.guardian_name || undefined,
        guardian_phone: form.guardian_phone || undefined,
      });
      setStudents((s) => [...s, created]);
      setForm({ admission_number: "", first_name: "", last_name: "", class_id: "", guardian_name: "", guardian_phone: "" });
      toast.success(`${created.first_name} ${created.last_name} enrolled`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to enroll student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Students" description="Enroll students and keep their records up to date." />

      {canEnroll && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enroll a student</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Admission number</Label>
                <Input required value={form.admission_number} onChange={(e) => set("admission_number", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>First name</Label>
                <Input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Last name</Label>
                <Input required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Class</Label>
                <Select value={form.class_id} onValueChange={(v) => set("class_id", v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Guardian name</Label>
                <Input value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Guardian phone</Label>
                <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button disabled={submitting} type="submit">
                  <UserPlus /> {submitting ? "Enrolling..." : "Enroll student"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Guardian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.admission_number}</TableCell>
                <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                <TableCell>
                  {classNameFor(s.class_id) ? <Badge variant="secondary">{classNameFor(s.class_id)}</Badge> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.guardian_name ?? "—"}</TableCell>
              </TableRow>
            ))}
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No students enrolled yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
