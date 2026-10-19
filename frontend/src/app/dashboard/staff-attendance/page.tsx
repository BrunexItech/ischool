"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { CalendarClock, Clock, Plus, QrCode, ScanLine, Trash2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EMPLOYEE_ROLES = ["school_admin", "super_admin", "teacher", "staff", "security", "boarding_staff", "transport_staff", "bursar"];

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function ScanDialog({ onScanned }: { onScanned: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function handleDecoded(data: string) {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      setBusy(true);
      try {
        if (!token || !user?.school_id) return;
        const result = await api.scanAttendanceQr(token, user.school_id, data);
        const time = result.action === "clocked_in" ? result.record.clocked_in_at : result.record.clocked_out_at;
        toast.success(`${result.action === "clocked_in" ? "Clocked in" : "Clocked out"} at ${fmtTime(time)}`);
        setOpen(false);
        onScanned();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to record attendance");
      } finally {
        setBusy(false);
      }
    }

    function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          handleDecoded(code.data);
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
        rafId = requestAnimationFrame(tick);
      })
      .catch(() => setError("Camera access was denied — allow camera permission to scan."));

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, token, user?.school_id, onScanned]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setError(null);
          setBusy(false);
        }
      }}
    >
      <DialogTrigger render={<Button className="flex-1"><ScanLine /> Scan to clock in / out</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan the attendance QR code</DialogTitle>
          <DialogDescription>Point your camera at the code posted at your school — one scan clocks you in, the next clocks you out.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Spinner size={24} className="text-white" />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClockCard() {
  const { token, user } = useAuth();
  const [today, setToday] = useState<StaffAttendanceRecord | null>(null);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
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
            {today?.clocked_in_at && today?.clocked_out_at ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-center text-sm text-muted-foreground">You&apos;re all done for today.</p>
            ) : (
              <ScanDialog onScanned={refresh} />
            )}
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

  async function handleDownloadQr() {
    if (!token || !user?.school_id) return;
    try {
      const { token: qrToken } = await api.getAttendanceQrCode(token, user.school_id);
      const dataUrl = await QRCode.toDataURL(qrToken, { width: 440, margin: 2, color: { dark: "#111827", light: "#ffffff" } });
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Allow pop-ups to download the QR sheet");
        return;
      }
      win.document.write(`<!doctype html>
<html><head><title>Staff Attendance QR Code</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
  .sheet { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 56px 64px; }
  .bar { width: 64px; height: 5px; border-radius: 999px; background: #2563eb; }
  h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: #0f172a; }
  p.subtitle { font-size: 18px; color: #475569; margin: 0; font-weight: 500; }
  img { border: 14px solid #0f172a; border-radius: 20px; margin-top: 8px; }
  p.hint { font-size: 13px; color: #94a3b8; margin-top: 8px; }
  @media print { body { background: #fff; } }
</style>
</head><body>
  <div class="sheet">
    <div class="bar"></div>
    <h1>Staff Attendance</h1>
    <p class="subtitle">Scan QR Code</p>
    <img src="${dataUrl}" width="320" height="320" />
    <p class="hint">Open the app, then scan this code to clock in or out.</p>
  </div>
  <script>window.onload = () => window.print();</script>
</body></html>`);
      win.document.close();
    } catch {
      toast.error("Failed to generate the QR code");
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></div>
          <div className="grid gap-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></div>
        </div>
        <Button variant="outline" onClick={handleDownloadQr}><QrCode /> Download QR sheet</Button>
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
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin" || user?.role === "supervisor";

  useEffect(() => {
    if (!loading && user && !EMPLOYEE_ROLES.includes(user.role) && user.role !== "supervisor") router.replace("/dashboard");
  }, [loading, user, router]);

  if (loading || !user) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff Attendance" description={isAdmin ? "Arrival records and the duty roster for your team." : "Clock in, clock out, and see your upcoming duties."} />
      {isAdmin ? <AdminRoster /> : <ClockCard />}
    </div>
  );
}
