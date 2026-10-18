"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError, AttendanceRecord, AttendanceStatus, SchoolClass, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Save } from "lucide-react";

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

function monthAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function HistoryCard({ schoolId, classes }: { schoolId: number; classes: SchoolClass[] }) {
  const { token } = useAuth();
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [historyClassId, setHistoryClassId] = useState("__all_classes__");
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [loading, setLoading] = useState(true);

  function run() {
    if (!token) return;
    const classFilter = historyClassId === "__all_classes__" ? undefined : Number(historyClassId);
    api
      .listAttendanceHistory(token, schoolId, from, to, classFilter)
      .then(setRecords)
      .catch(() => {
        toast.error("Failed to load attendance history");
        setRecords(null);
      })
      .finally(() => setLoading(false));
  }

  function handleSearch() {
    setLoading(true);
    run();
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const byDate = useMemo(() => {
    if (!records) return [];
    const map = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
    for (const r of records) {
      const row = map.get(r.date) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      row[r.status] += 1;
      row.total += 1;
      map.set(r.date, row);
    }
    return Array.from(map.entries())
      .map(([date, counts]) => ({ date, ...counts, rate: counts.total ? Math.round(((counts.total - counts.absent) / counts.total) * 1000) / 10 : 0 }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [records]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><History className="size-4.5" /> Attendance history</CardTitle>
        <CardDescription>Look back at any date range — e.g. last month, a specific week.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={historyClassId} onValueChange={(v) => v && setHistoryClassId(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_classes__">Every class</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handleSearch} disabled={loading}>
            {loading ? <Spinner size={16} className="text-current" /> : <History />} {loading ? "Loading..." : "Search"}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Late</TableHead>
              <TableHead className="text-right">Excused</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byDate.map((row) => (
              <TableRow key={row.date}>
                <TableCell className="font-medium">{new Date(row.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">{row.present}</TableCell>
                <TableCell className="text-right tabular-nums text-amber-600">{row.late}</TableCell>
                <TableCell className="text-right tabular-nums text-sky-600">{row.excused}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600">{row.absent}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{row.rate}%</TableCell>
              </TableRow>
            ))}
            {byDate.length === 0 && (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{loading ? "Loading..." : "No attendance recorded in this range."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function AttendancePage() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const preselectClassId = searchParams.get("class_id");
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listClasses(token, user.school_id).then((cs) => {
      setClasses(cs);
      const preselected = preselectClassId ? cs.find((c) => c.id === Number(preselectClassId)) : undefined;
      if (preselected) setClassId(preselected.id);
      else if (cs.length > 0) setClassId(cs[0].id);
    }).finally(() => setLoading(false));
  }, [token, user?.school_id, preselectClassId]);

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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Attendance" description="Mark daily attendance for a class." />
        <PageLoader />
      </div>
    );
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

      {user?.school_id && <HistoryCard schoolId={user.school_id} classes={classes} />}
    </div>
  );
}
