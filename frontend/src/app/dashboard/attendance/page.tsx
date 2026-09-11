"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, AttendanceStatus, SchoolClass, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save } from "lucide-react";

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "excused"];

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "text-emerald-600",
  absent: "text-red-600",
  late: "text-amber-600",
  excused: "text-sky-600",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { user, token } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listClasses(token, user.school_id).then((cs) => {
      setClasses(cs);
      if (cs.length > 0) setClassId(cs[0].id);
    });
  }, [token, user?.school_id]);

  useEffect(() => {
    if (!token || !user?.school_id || classId === null) return;
    api.listStudents(token, user.school_id, classId).then(setStudents);
    api.listAttendance(token, user.school_id, classId, date).then((records) => {
      const map: Record<number, AttendanceStatus> = {};
      for (const r of records) map[r.student_id] = r.status;
      setStatuses(map);
    });
  }, [token, user?.school_id, classId, date]);

  const roster = useMemo(() => students, [students]);

  function setStatus(studentId: number, status: AttendanceStatus) {
    setStatuses((s) => ({ ...s, [studentId]: status }));
  }

  async function handleSave() {
    if (!token || !user?.school_id || classId === null) return;
    setSaving(true);
    try {
      await api.markAttendance(token, user.school_id, {
        class_id: classId,
        date,
        records: roster.map((s) => ({ student_id: s.id, status: statuses[s.id] ?? "present" })),
      });
      toast.success("Attendance saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Attendance" description="Mark daily attendance for a class." />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button onClick={handleSave} disabled={saving || roster.length === 0}>
            <Save /> {saving ? "Saving..." : "Save attendance"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-40">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.admission_number}</TableCell>
                <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                <TableCell>
                  <Select value={statuses[s.id] ?? "present"} onValueChange={(v) => v && setStatus(s.id, v as AttendanceStatus)}>
                    <SelectTrigger className={`w-36 capitalize ${STATUS_STYLES[statuses[s.id] ?? "present"]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {roster.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No students in this class.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
