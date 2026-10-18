"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Clock, LogIn, LogOut, Plus, Trash2 } from "lucide-react";
import { api, ApiError, DutyAssignment, DutyAssignmentWithName, Staff, StaffAttendanceRecord, StaffAttendanceWithName } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EMPLOYEE_ROLES = ["school_admin", "super_admin", "teacher", "staff", "security", "boarding_staff", "transport_staff", "bursar"];

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function ClockCard() {
  const { token, user } = useAuth();
  const [today, setToday] = useState<StaffAttendanceRecord | null>(null);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function refresh() {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.myStaffAttendance(token, user.school_id).then((rows) => {
        setHistory(rows);
        const todayStr = new Date().toISOString().slice(0, 10);
        setToday(rows.find((r) => r.date === todayStr) ?? null);
      }),
      api.listMyDuties(token, user.school_id).then(setDuties).catch(() => setDuties([])),
    ]).finally(() => setLoading(false));
  }

  useEffect(refresh, [token, user?.school_id]);

  async function handleClockIn() {
    if (!token || !user?.school_id) return;
    setBusy(true);
    try {
      await api.clockIn(token, user.school_id);
      toast.success("Clocked in");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to clock in");
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    if (!token || !user?.school_id) return;
    setBusy(true);
    try {
      await api.clockOut(token, user.school_id);
      toast.success("Clocked out");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to clock out");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Today</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Clocked in</p>
                <p className="font-heading text-lg font-semibold">{fmtTime(today?.clocked_in_at ?? null)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clocked out</p>
                <p className="font-heading text-lg font-semibold">{fmtTime(today?.clocked_out_at ?? null)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button disabled={busy || !!today?.clocked_in_at} onClick={handleClockIn} className="flex-1">
                {busy ? <Spinner size={16} className="text-current" /> : <LogIn />} Clock in
              </Button>
              <Button disabled={busy || !today?.clocked_in_at || !!today?.clocked_out_at} variant="outline" onClick={handleClockOut} className="flex-1">
                <LogOut /> Clock out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming duties</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {duties.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{d.start_time ? ` · ${d.start_time.slice(0, 5)}–${d.end_time?.slice(0, 5) ?? ""}` : ""}</p>
                </div>
              </div>
            ))}
            {duties.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No duties assigned.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your attendance history</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Date</TableHead><TableHead>Clock in</TableHead><TableHead>Clock out</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {history.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{new Date(h.date + "T12:00:00").toLocaleDateString()}</TableCell>
                <TableCell>{fmtTime(h.clocked_in_at)}</TableCell>
                <TableCell>{fmtTime(h.clocked_out_at)}</TableCell>
              </TableRow>
            ))}
            {history.length === 0 && <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No records yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function AdminRoster() {
  const { token, user } = useAuth();
  const [records, setRecords] = useState<StaffAttendanceWithName[]>([]);
  const [duties, setDuties] = useState<DutyAssignmentWithName[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [dutyForm, setDutyForm] = useState(() => ({ userId: "", title: "", date: new Date().toISOString().slice(0, 10), start: "", end: "" }));
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  function refresh() {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listStaffAttendance(token, user.school_id, from, to).then(setRecords),
      api.listDuties(token, user.school_id, from, to).then(setDuties),
      api.listStaff(token, user.school_id).then(setStaff),
    ]).finally(() => setLoading(false));
  }

  useEffect(refresh, [token, user?.school_id, from, to]);

  async function handleAssignDuty(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !dutyForm.userId || !dutyForm.title) return;
    setSubmitting(true);
    try {
      await api.createDuty(token, user.school_id, {
        user_id: Number(dutyForm.userId),
        title: dutyForm.title,
        date: dutyForm.date,
        start_time: dutyForm.start ? `${dutyForm.start}:00` : undefined,
        end_time: dutyForm.end ? `${dutyForm.end}:00` : undefined,
      });
      toast.success("Duty assigned");
      setDutyForm({ userId: "", title: "", date: new Date().toISOString().slice(0, 10), start: "", end: "" });
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to assign duty");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteDuty(id: number) {
    if (!token || !user?.school_id) return;
    await api.deleteDuty(token, user.school_id, id);
    setDuties((d) => d.filter((x) => x.id !== id));
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></div>
        <div className="grid gap-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Clock-in records</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Staff</TableHead><TableHead>Date</TableHead><TableHead>Clock in</TableHead><TableHead>Clock out</TableHead><TableHead>Note</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.staff_name}</TableCell>
                <TableCell>{new Date(r.date + "T12:00:00").toLocaleDateString()}</TableCell>
                <TableCell>{fmtTime(r.clocked_in_at)}</TableCell>
                <TableCell>{fmtTime(r.clocked_out_at)}</TableCell>
                <TableCell className="text-muted-foreground">{r.note ?? "—"}</TableCell>
              </TableRow>
            ))}
            {records.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No records in this range.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4.5" /> Assign a duty</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAssignDuty} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-1.5">
              <Label>Staff member</Label>
              <Select required value={dutyForm.userId} onValueChange={(v) => v && setDutyForm((f) => ({ ...f, userId: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.user_id} value={String(s.user_id)}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Duty</Label><Input required placeholder="e.g. Gate duty" value={dutyForm.title} onChange={(e) => setDutyForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Date</Label><Input required type="date" value={dutyForm.date} onChange={(e) => setDutyForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Starts</Label><Input type="time" value={dutyForm.start} onChange={(e) => setDutyForm((f) => ({ ...f, start: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Ends</Label><Input type="time" value={dutyForm.end} onChange={(e) => setDutyForm((f) => ({ ...f, end: e.target.value }))} /></div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button disabled={submitting} type="submit">{submitting ? "Assigning..." : "Assign duty"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Duty roster</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {duties.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-3">
                <Badge variant="secondary"><CalendarClock className="size-3" /></Badge>
                <div>
                  <p className="font-medium">{d.title} <span className="font-normal text-muted-foreground">— {d.staff_name}</span></p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    {d.start_time && <><Clock className="size-3" /> {d.start_time.slice(0, 5)}–{d.end_time?.slice(0, 5) ?? ""}</>}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDeleteDuty(d.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
            </div>
          ))}
          {duties.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No duties in this range.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default function StaffAttendancePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  useEffect(() => {
    if (!loading && user && !EMPLOYEE_ROLES.includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  if (loading || !user) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff Attendance" description={isAdmin ? "Arrival records and the duty roster for your team." : "Clock in, clock out, and see your upcoming duties."} />
      {isAdmin ? <AdminRoster /> : <ClockCard />}
    </div>
  );
}
