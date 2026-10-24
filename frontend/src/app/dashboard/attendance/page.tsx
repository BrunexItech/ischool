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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Save, Search } from "lucide-react";

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "late", "absent", "excused"];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "P",
  late: "L",
  absent: "A",
  excused: "E",
};

const STATUS_FULL_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

const STATUS_ACTIVE_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-emerald-600 text-white hover:bg-emerald-600",
  late: "bg-amber-500 text-white hover:bg-amber-500",
  absent: "bg-red-600 text-white hover:bg-red-600",
  excused: "bg-sky-600 text-white hover:bg-sky-600",
};

const STATUS_BADGE_STYLES: Record<AttendanceStatus, string> = {
  present: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  late: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  absent: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  excused: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
};

const NEEDS_REASON: AttendanceStatus[] = ["absent", "late", "excused"];

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
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
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-44" />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-44" />
          </div>
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={historyClassId} onValueChange={(v) => v && setHistoryClassId(v)}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
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
                <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
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
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canMark = user?.role === "super_admin" || user?.role === "teacher" || user?.role === "staff";

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
      const statusMap: Record<number, AttendanceStatus> = {};
      const reasonMap: Record<number, string> = {};
      for (const r of records) {
        statusMap[r.student_id] = r.status;
        if (r.reason) reasonMap[r.student_id] = r.reason;
      }
      setStatuses(statusMap);
      setReasons(reasonMap);
    });
  }, [token, user?.school_id, classId, date]);

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        s.admission_number.toLowerCase().includes(q)
    );
  }, [students, search]);

  const selectedClass = classes.find((c) => c.id === classId);

  const counts = useMemo(() => {
    const result = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const s of students) {
      const status = statuses[s.id];
      if (!status) result.unmarked += 1;
      else result[status] += 1;
    }
    return result;
  }, [students, statuses]);

  function setStatus(studentId: number, status: AttendanceStatus) {
    if (!canMark) return;
    setStatuses((s) => ({ ...s, [studentId]: status }));
    if (!NEEDS_REASON.includes(status)) {
      setReasons((r) => {
        const next = { ...r };
        delete next[studentId];
        return next;
      });
    }
  }

  function setReason(studentId: number, reason: string) {
    if (!canMark) return;
    setReasons((r) => ({ ...r, [studentId]: reason }));
  }

  async function handleSave() {
    if (!token || !user?.school_id || classId === null) return;
    setSaving(true);
    try {
      await api.markAttendance(token, user.school_id, {
        class_id: classId,
        date,
        records: students.map((s) => {
          const status = statuses[s.id] ?? "present";
          const reason = NEEDS_REASON.includes(status) ? reasons[s.id]?.trim() : undefined;
          return { student_id: s.id, status, reason: reason || undefined };
        }),
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
        <PageHeader title="Attendance" description="Daily register." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attendance"
        description={`Daily register · saved for ${formatDate(date)}`}
        action={
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
                <SelectTrigger className="w-40 sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 sm:w-44" />
            </div>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{selectedClass ? `${selectedClass.name} register` : "Register"}</CardTitle>
          <CardDescription>
            {canMark ? "Tap P present, L late, A absent, E excused. " : "Read-only — recorded by the class teacher. "}
            {students.length} learner{students.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={STATUS_BADGE_STYLES.present}>Present {counts.present}</Badge>
              <Badge variant="outline" className={STATUS_BADGE_STYLES.late}>Late {counts.late}</Badge>
              <Badge variant="outline" className={STATUS_BADGE_STYLES.absent}>Absent {counts.absent}</Badge>
              <Badge variant="secondary">Unmarked {counts.unmarked}</Badge>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or admission no"
                className="pl-8"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Adm No</TableHead>
                <TableHead className="w-48">Mark</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.map((s) => {
                const status = statuses[s.id] ?? "present";
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>{initials(s.first_name, s.last_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{s.first_name} {s.last_name}</div>
                          {s.gender && <div className="text-xs text-muted-foreground capitalize">{s.gender}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.admission_number}</TableCell>
                    <TableCell>
                      {canMark ? (
                        <div className="flex gap-1">
                          {STATUS_OPTIONS.map((opt) => (
                            <Button
                              key={opt}
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label={STATUS_FULL_LABEL[opt]}
                              className={status === opt ? STATUS_ACTIVE_STYLES[opt] : ""}
                              onClick={() => setStatus(s.id, opt)}
                            >
                              {STATUS_LABEL[opt]}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="outline" className={STATUS_BADGE_STYLES[status]}>{STATUS_FULL_LABEL[status]}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {NEEDS_REASON.includes(status) ? (
                        canMark ? (
                          <Input
                            value={reasons[s.id] ?? ""}
                            onChange={(e) => setReason(s.id, e.target.value)}
                            placeholder="Why? e.g. Sick, travelling..."
                            className="min-w-48"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">{reasons[s.id] || "No reason given"}</span>
                        )
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {roster.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {students.length === 0 ? "No students in this class." : "No learners match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {canMark && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || students.length === 0}>
                <Save /> {saving ? "Saving..." : "Save attendance"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {user?.school_id && <HistoryCard schoolId={user.school_id} classes={classes} />}
    </div>
  );
}
