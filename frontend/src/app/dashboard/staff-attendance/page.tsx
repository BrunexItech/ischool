"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Clock, Plus, Printer, QrCode, RotateCw, ScanLine, Trash2 } from "lucide-react";
import {
  api,
  ApiError,
  DutyAssignment,
  DutyAssignmentWithName,
  Staff,
  StaffAttendanceRecord,
  StaffDay,
  StaffDayRow,
  StaffLeave,
  StaffPerson,
  StaffSummary,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EMPLOYEE_ROLES = ["head_of_institution", "super_admin", "teacher", "staff", "security", "boarding_staff", "transport_staff", "bursar"];

const LEAVE_TYPES: Record<string, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  maternity: "Maternity leave",
  paternity: "Paternity leave",
  study: "Study leave",
  official_duty: "Official duty",
  compassionate: "Compassionate leave",
  other: "Other",
};
const ABSENCE_REASONS: Record<string, string> = { sick: "Sick", official_duty: "Official duty", family_matter: "Family matter", other: "Other" };
const STATUS_TEXT: Record<string, string> = { present: "Present", late: "Late", absent: "Absent", on_leave: "On leave", expected: "Expected" };
const STATUS_PILL: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  late: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  on_leave: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  expected: "bg-muted text-muted-foreground",
};
const roleLabel = (r: string) => r.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function fmtDay(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function Pill({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_PILL[status]}`}>{STATUS_TEXT[status]}</span>;
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
      {items.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} onClick={() => onChange(key)} className={`h-9 shrink-0 rounded-md px-4 text-sm font-medium transition-colors ${value === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-12 text-center text-sm text-muted-foreground">{children}</p>;
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


async function downloadQrSheet(token: string, schoolId: number) {
  try {
    const { token: qrToken } = await api.getAttendanceQrCode(token, schoolId);
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
.bar { width: 64px; height: 5px; border-radius: 999px; background: #8B1A1D; }
h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: #0f172a; }
p.subtitle { font-size: 18px; color: #475569; margin: 0; font-weight: 500; }
img { border: 10px solid #0f172a; margin-top: 8px; }
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


function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
      <AlertTriangle className="size-6 text-red-600" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}><RotateCw /> Try again</Button>
    </div>
  );
}

// ---------- Leave & reason dialogs (leadership) ----------

function LeaveDialog({ people, initialUser, onClose, onSaved }: { people: StaffPerson[]; initialUser?: number; onClose: () => void; onSaved: () => void }) {
  const { token, user } = useAuth();
  const [form, setForm] = useState({ userId: initialUser ? String(initialUser) : "", type: "annual", start: localDateStr(), end: localDateStr(), note: "" });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.userId) return;
    setSaving(true);
    try {
      await api.recordStaffLeave(token, user.school_id, { user_id: Number(form.userId), start_date: form.start, end_date: form.end, leave_type: form.type, note: form.note.trim() || undefined });
      toast.success("Leave recorded");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not record the leave");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Record leave</DialogTitle><DialogDescription>Only genuine, approved leave should be recorded. The days will not count as absences.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label>Staff member</Label>
            <Select value={form.userId} onValueChange={(v) => v && setForm((f) => ({ ...f, userId: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a staff member" /></SelectTrigger>
              <SelectContent>{people.map((p) => <SelectItem key={p.user_id} value={String(p.user_id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Type of leave</Label>
            <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(LEAVE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label>From</Label><Input required type="date" value={form.start} max={form.end} onChange={(e) => e.target.value && setForm((f) => ({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end }))} /></div>
            <div className="grid gap-1.5"><Label>To</Label><Input required type="date" value={form.end} min={form.start} onChange={(e) => e.target.value && setForm((f) => ({ ...f, end: e.target.value }))} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Note (optional)</Label><Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.userId}>{saving && <Spinner size={16} className="text-current" />} Record leave</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({ row, date, onClose, onSaved }: { row: StaffDayRow; date: string; onClose: () => void; onSaved: () => void }) {
  const { token, user } = useAuth();
  const [reason, setReason] = useState(row.reason ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !reason) return;
    setSaving(true);
    try {
      await api.setAbsenceNote(token, user.school_id, { user_id: row.user_id, date, reason, note: note.trim() || undefined });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
      setSaving(false);
    }
  }

  async function clear() {
    if (!token || !user?.school_id) return;
    try {
      await api.clearAbsenceNote(token, user.school_id, row.user_id, date);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not clear");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Why was {row.name} away?</DialogTitle><DialogDescription>{fmtDay(date)}</DialogDescription></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Reason" className="grid gap-2">
            {Object.entries(ABSENCE_REASONS).map(([k, v]) => (
              <button key={k} type="button" role="radio" aria-checked={reason === k} onClick={() => setReason(k)} className={`flex h-11 items-center rounded-lg border px-3 text-left text-sm font-medium transition-colors ${reason === k ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"}`}>{v}</button>
            ))}
          </div>
          <Textarea rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex items-center justify-between gap-2">
            {row.reason ? <Button type="button" variant="ghost" onClick={clear}>Remove reason</Button> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !reason}>{saving && <Spinner size={16} className="text-current" />} Save</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Leadership tabs ----------

function DayTab({ people, onLeave }: { people: StaffPerson[]; onLeave: (userId?: number) => void }) {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [date, setDate] = useState(localDateStr());
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<{ key: string; day: StaffDay | null } | null>(null);
  const [reasonFor, setReasonFor] = useState<StaffDayRow | null>(null);
  const key = `${date}/${reloadKey}`;

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.getStaffDay(token, schoolId, date).then((day) => !cancelled && setData({ key, day })).catch(() => !cancelled && setData({ key, day: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, date, key]);

  const ready = data && data.key === key;
  const day = ready ? data.day : null;
  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, late: 0, absent: 0, on_leave: 0, expected: 0 };
    for (const r of day?.rows ?? []) c[r.status] += 1;
    return c;
  }, [day]);
  void people;
  const isToday = date === localDateStr();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Previous day" onClick={() => setDate((d) => addDaysStr(d, -1))}><ChevronLeft /></Button>
        <Input type="date" value={date} max={localDateStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 w-44" />
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Next day" disabled={isToday} onClick={() => setDate((d) => addDaysStr(d, 1))}><ChevronRight /></Button>
        {!isToday && <Button type="button" variant="ghost" className="h-10" onClick={() => setDate(localDateStr())}>Today</Button>}
      </div>

      {!ready ? (
        <PageLoader />
      ) : !day ? (
        <ErrorBox message="We couldn't load this day." onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !day.school_day ? (
        <div className="rounded-xl border bg-card"><Empty>{day.holiday ? `${day.holiday} is a holiday on the school calendar, so nobody is expected.` : "This is not a school day (weekend or outside term), so nobody is expected."}</Empty></div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([["present", "Present"], ["late", "Late"], ["absent", "Absent"], ["on_leave", "On leave"]] as const).map(([k, label]) => (
              <div key={k} className="rounded-xl border bg-card p-3.5">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-heading text-2xl font-semibold tabular-nums">{counts[k]}</dd>
              </div>
            ))}
          </dl>
          {counts.expected > 0 && <p className="text-sm text-muted-foreground">{counts.expected} not in yet. They count as absent once the cut-off time passes.</p>}

          <section className="overflow-hidden rounded-xl border bg-card">
            {day.rows.length === 0 ? (
              <Empty>No staff are being tracked yet.</Empty>
            ) : (
              <ul className="divide-y">
                {day.rows.map((r) => (
                  <li key={r.user_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabel(r.role)}
                        {r.lessons > 0 ? ` · ${r.lessons} lesson${r.lessons === 1 ? "" : "s"} on the timetable` : ""}
                      </p>
                      {r.register_status === "missing" && <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Class register not taken</p>}
                      {r.register_status === "other" && r.status === "absent" && <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Absent, but someone else took their class register</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:justify-end">
                      <Pill status={r.status} />
                      {r.status === "on_leave" && <span className="text-muted-foreground">{LEAVE_TYPES[r.leave_type ?? ""] ?? r.leave_type}</span>}
                      {r.status === "absent" && r.reason && <span className="text-muted-foreground">{ABSENCE_REASONS[r.reason] ?? r.reason}</span>}
                      {r.source === "register" && <span className="text-xs text-muted-foreground">Marked a register</span>}
                      {r.clocked_in_at && (
                        <span className="text-muted-foreground tabular-nums">
                          In {fmtTime(r.clocked_in_at)}{r.clocked_out_at ? ` · Out ${fmtTime(r.clocked_out_at)}` : ""}
                        </span>
                      )}
                    </div>
                    {r.status === "absent" && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-10 sm:h-8" onClick={() => setReasonFor(r)}>{r.reason ? "Edit reason" : "Give reason"}</Button>
                        <Button size="sm" variant="ghost" className="h-10 sm:h-8" onClick={() => onLeave(r.user_id)}>Record leave</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {reasonFor && <ReasonDialog row={reasonFor} date={date} onClose={() => setReasonFor(null)} onSaved={() => setReloadKey((k) => k + 1)} />}
    </div>
  );
}

function monthStart(d = new Date()) {
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

function SummaryTable({ summary, showNames }: { summary: StaffSummary; showNames: boolean }) {
  const cols: [keyof StaffSummary["rows"][number], string][] = [["present", "Present"], ["late", "Late"], ["on_leave", "On leave"], ["absent_explained", "Absent, with reason"], ["absent_unexplained", "Absent, no reason"]];
  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden print:hidden">
        {summary.rows.map((r) => (
          <li key={r.user_id} className="rounded-xl border bg-card p-4">
            {showNames && <p className="font-medium">{r.name}</p>}
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              {cols.map(([k, label]) => (
                <div key={k}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{r[k] as number}</dd></div>
              ))}
              <div><dt className="text-[11px] text-muted-foreground">School days</dt><dd className="font-semibold tabular-nums">{r.school_days}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block print:block print:rounded-none print:border-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-left print:bg-neutral-100">
              {showNames && <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase print:border print:border-neutral-400">Staff</th>}
              {cols.map(([k, label]) => <th key={k} className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide uppercase print:border print:border-neutral-400">{label}</th>)}
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide uppercase print:border print:border-neutral-400">School days</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <tr key={r.user_id} className="border-t">
                {showNames && <td className="px-3 py-2.5 font-medium print:border print:border-neutral-400">{r.name}<span className="block text-xs font-normal text-muted-foreground">{roleLabel(r.role)}</span></td>}
                {cols.map(([k]) => <td key={k} className={`px-3 py-2.5 text-right tabular-nums print:border print:border-neutral-400 ${k === "absent_unexplained" && (r[k] as number) > 0 ? "font-semibold text-red-700 dark:text-red-400" : ""}`}>{r[k] as number}</td>)}
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums print:border print:border-neutral-400">{r.school_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SummaryTab({ isAdmin }: { isAdmin: boolean }) {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [range, setRange] = useState({ from: monthStart(), to: localDateStr() });
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<{ key: string; summary: StaffSummary | null } | null>(null);
  const key = `${range.from}/${range.to}/${reloadKey}`;

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.getStaffSummary(token, schoolId, range.from, range.to).then((summary) => !cancelled && setData({ key, summary })).catch(() => !cancelled && setData({ key, summary: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, range, key]);

  const ready = data && data.key === key;
  const summary = ready ? data.summary : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="grid gap-1.5"><Label>From</Label><Input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className="h-10 w-44" /></div>
        <div className="grid gap-1.5"><Label>To</Label><Input type="date" value={range.to} min={range.from} max={localDateStr()} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className="h-10 w-44" /></div>
        <Button variant="outline" className="h-10" onClick={() => window.print()} disabled={!summary || summary.rows.length === 0}><Printer /> Print</Button>
      </div>
      <div className="hidden print:block"><h1 className="text-xl font-bold">Staff attendance summary</h1><p className="text-sm">{fmtDay(range.from)} to {fmtDay(range.to)}</p></div>
      {!ready ? <PageLoader /> : !summary ? <ErrorBox message="We couldn't load the summary." onRetry={() => setReloadKey((k) => k + 1)} /> : summary.rows.length === 0 ? (
        <div className="rounded-xl border bg-card"><Empty>No staff to report on for this period.</Empty></div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground print:hidden">{summary.school_days} school day{summary.school_days === 1 ? "" : "s"} in this period. Weekends and holidays are not counted.</p>
          <SummaryTable summary={summary} showNames={isAdmin} />
        </>
      )}
    </div>
  );
}

function LeaveTab({ people, isAdmin, openDialog, reloadKey }: { people: StaffPerson[]; isAdmin: boolean; openDialog: () => void; reloadKey: number }) {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [data, setData] = useState<{ key: number; leaves: StaffLeave[] | null } | null>(null);
  const [local, setLocal] = useState(0);
  const key = reloadKey * 1000 + local;
  void people;

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.listStaffLeaves(token, schoolId).then((leaves) => !cancelled && setData({ key, leaves })).catch(() => !cancelled && setData({ key, leaves: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, key]);

  async function remove(id: number) {
    if (!token || !schoolId) return;
    try {
      await api.deleteStaffLeave(token, schoolId, id);
      setLocal((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove");
    }
  }

  const ready = data && data.key === key;
  const leaves = ready ? data.leaves : null;
  return (
    <div className="flex flex-col gap-4">
      {isAdmin && <Button className="h-10 w-fit" onClick={openDialog}><Plus /> Record leave</Button>}
      {!ready ? <PageLoader /> : leaves === null ? <ErrorBox message="We couldn't load the leave list." onRetry={() => setLocal((n) => n + 1)} /> : leaves.length === 0 ? (
        <div className="rounded-xl border bg-card"><Empty>No leave recorded.</Empty></div>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card divide-y">
          {leaves.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                {isAdmin && <p className="font-medium break-words">{l.staff_name}</p>}
                <p className="text-sm">{LEAVE_TYPES[l.leave_type] ?? l.leave_type}</p>
                <p className="text-xs text-muted-foreground">{fmtDay(l.start_date)}{l.end_date !== l.start_date ? ` to ${fmtDay(l.end_date)}` : ""}{l.recorded_by_name ? ` · recorded by ${l.recorded_by_name}` : ""}</p>
                {l.note && <p className="mt-0.5 text-xs break-words text-muted-foreground">{l.note}</p>}
              </div>
              {isAdmin && <Button variant="ghost" size="icon" className="size-10 shrink-0 text-destructive" aria-label="Remove leave" onClick={() => remove(l.id)}><Trash2 /></Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsTab({ people, onChanged }: { people: StaffPerson[]; onChanged: () => void }) {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [times, setTimes] = useState<{ late: string; absent: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.getStaffSettings(token, schoolId).then((s) => !cancelled && setTimes({ late: s.late_after.slice(0, 5), absent: s.absent_after.slice(0, 5) })).catch(() => !cancelled && setTimes({ late: "07:45", absent: "10:00" }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !schoolId || !times) return;
    setSaving(true);
    try {
      await api.setStaffSettings(token, schoolId, { late_after: `${times.late}:00`, absent_after: `${times.absent}:00` });
      toast.success("Times saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: StaffPerson, tracked: boolean) {
    if (!token || !schoolId) return;
    try {
      await api.setStaffTracking(token, schoolId, p.user_id, tracked);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-heading text-lg font-semibold">Arrival times</h2>
        <p className="text-sm text-muted-foreground">A scan after the late time counts as late. Anyone expected who has not scanned or marked a register by the absent time counts as absent.</p>
        {times && (
          <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5"><Label>Late after</Label><Input type="time" required value={times.late} onChange={(e) => setTimes((t) => t && { ...t, late: e.target.value })} className="h-10 w-36" /></div>
            <div className="grid gap-1.5"><Label>Absent after</Label><Input type="time" required value={times.absent} onChange={(e) => setTimes((t) => t && { ...t, absent: e.target.value })} className="h-10 w-36" /></div>
            <Button type="submit" className="h-10" disabled={saving}>{saving && <Spinner size={16} className="text-current" />} Save times</Button>
          </form>
        )}
      </section>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3 sm:px-5">
          <h2 className="font-heading text-lg font-semibold">Who is expected</h2>
          <p className="text-sm text-muted-foreground">Untick anyone who does not work on normal school days, such as a visiting or part-time teacher.</p>
        </div>
        <ul className="divide-y">
          {people.map((p) => (
            <li key={p.user_id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 sm:px-5">
                <Checkbox checked={p.tracked} onCheckedChange={(v) => toggle(p, v === true)} />
                <span className="min-w-0 flex-1"><span className="block font-medium break-words">{p.name}</span><span className="block text-xs text-muted-foreground">{roleLabel(p.role)}</span></span>
              </label>
            </li>
          ))}
          {people.length === 0 && <Empty>No staff yet.</Empty>}
        </ul>
      </section>
    </div>
  );
}

function DutiesTab() {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [duties, setDuties] = useState<DutyAssignmentWithName[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState(() => ({ userId: "", title: "", date: localDateStr(), start: "", end: "" }));
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const from = localDateStr();
  const to = addDaysStr(from, 30);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    Promise.all([api.listDuties(token, schoolId, from, to).catch(() => [] as DutyAssignmentWithName[]), api.listStaff(token, schoolId).catch(() => [] as Staff[])]).then(([d, s]) => {
      if (cancelled) return;
      setDuties(d);
      setStaff(s);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, from, to, reloadKey]);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !schoolId || !form.userId || !form.title) return;
    setSubmitting(true);
    try {
      await api.createDuty(token, schoolId, { user_id: Number(form.userId), title: form.title, date: form.date, start_time: form.start ? `${form.start}:00` : undefined, end_time: form.end ? `${form.end}:00` : undefined });
      toast.success("Duty assigned");
      setForm({ userId: "", title: "", date: localDateStr(), start: "", end: "" });
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to assign duty");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    if (!token || !schoolId) return;
    await api.deleteDuty(token, schoolId, id);
    setDuties((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={assign} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5 lg:items-end">
        <div className="grid gap-1.5">
          <Label>Staff member</Label>
          <Select required value={form.userId} onValueChange={(v) => v && setForm((f) => ({ ...f, userId: v }))}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose..." /></SelectTrigger>
            <SelectContent>{staff.map((s) => <SelectItem key={s.user_id} value={String(s.user_id)}>{s.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5"><Label>Duty</Label><Input required placeholder="e.g. Gate duty" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="h-10" /></div>
        <div className="grid gap-1.5"><Label>Date</Label><Input required type="date" value={form.date} onChange={(e) => e.target.value && setForm((f) => ({ ...f, date: e.target.value }))} className="h-10" /></div>
        <div className="grid grid-cols-2 gap-2 lg:col-span-1">
          <div className="grid gap-1.5"><Label>Starts</Label><Input type="time" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} className="h-10" /></div>
          <div className="grid gap-1.5"><Label>Ends</Label><Input type="time" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} className="h-10" /></div>
        </div>
        <Button type="submit" className="h-10" disabled={submitting}>{submitting ? "Assigning..." : "Assign duty"}</Button>
      </form>
      <section className="overflow-hidden rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-heading text-lg font-semibold sm:px-5">Duty roster, next 30 days</h2>
        {duties.length === 0 ? <Empty>No duties assigned.</Empty> : (
          <ul className="divide-y">
            {duties.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{d.title} <span className="font-normal text-muted-foreground">· {d.staff_name}</span></p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">{fmtDay(d.date)}{d.start_time && <><Clock className="size-3" /> {d.start_time.slice(0, 5)}{d.end_time ? `–${d.end_time.slice(0, 5)}` : ""}</>}</p>
                </div>
                <Button variant="ghost" size="icon" className="size-10 shrink-0 text-destructive" aria-label="Remove duty" onClick={() => remove(d.id)}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AdminView() {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [tab, setTab] = useState<"day" | "summary" | "leave" | "duties" | "settings">("day");
  const [people, setPeople] = useState<StaffPerson[]>([]);
  const [peopleKey, setPeopleKey] = useState(0);
  const [leaveDialog, setLeaveDialog] = useState<{ open: boolean; userId?: number }>({ open: false });
  const [leaveKey, setLeaveKey] = useState(0);
  const [dayKey, setDayKey] = useState(0);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.listStaffPeople(token, schoolId).then((p) => !cancelled && setPeople(p)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, peopleKey]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[["day", "Day"], ["summary", "Summary"], ["leave", "Leave"], ["duties", "Duties"], ["settings", "Settings"]]}
        />
        <Button variant="outline" className="h-10 sm:h-9" onClick={() => token && schoolId && downloadQrSheet(token, schoolId)}><QrCode /> Download QR sheet</Button>
      </div>
      {tab === "day" && <DayTab key={dayKey} people={people} onLeave={(userId) => setLeaveDialog({ open: true, userId })} />}
      {tab === "summary" && <SummaryTab isAdmin />}
      {tab === "leave" && <LeaveTab people={people} isAdmin openDialog={() => setLeaveDialog({ open: true })} reloadKey={leaveKey} />}
      {tab === "duties" && <DutiesTab />}
      {tab === "settings" && <SettingsTab people={people} onChanged={() => { setPeopleKey((k) => k + 1); setDayKey((k) => k + 1); }} />}
      {leaveDialog.open && (
        <LeaveDialog
          people={people.filter((p) => p.tracked)}
          initialUser={leaveDialog.userId}
          onClose={() => setLeaveDialog({ open: false })}
          onSaved={() => { setLeaveKey((k) => k + 1); setDayKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

// ---------- Everyone else ----------

function MyView() {
  const { token, user } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [tab, setTab] = useState<"today" | "summary" | "leave">("today");
  const [today, setToday] = useState<StaffAttendanceRecord | null>(null);
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    Promise.all([
      api.myStaffAttendance(token, schoolId).catch(() => [] as StaffAttendanceRecord[]),
      api.listMyDuties(token, schoolId).catch(() => [] as DutyAssignment[]),
    ]).then(([rows, d]) => {
      if (cancelled) return;
      setToday(rows.find((r) => r.date === localDateStr()) ?? null);
      setDuties(d);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, reloadKey]);

  if (!loaded) return <PageLoader />;
  return (
    <div className="flex flex-col gap-5">
      <Tabs value={tab} onChange={setTab} items={[["today", "Today"], ["summary", "My attendance"], ["leave", "My leave"]]} />
      {tab === "today" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="font-heading text-lg font-semibold">Today</h2>
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
              <div><p className="text-xs text-muted-foreground">Clocked in</p><p className="font-heading text-lg font-semibold tabular-nums">{fmtTime(today?.clocked_in_at ?? null)}</p></div>
              <div><p className="text-xs text-muted-foreground">Clocked out</p><p className="font-heading text-lg font-semibold tabular-nums">{fmtTime(today?.clocked_out_at ?? null)}</p></div>
            </div>
            {today?.clocked_in_at && today?.clocked_out_at ? <p className="rounded-lg border bg-muted/30 p-3 text-center text-sm text-muted-foreground">You&apos;re all done for today.</p> : <ScanDialog onScanned={() => setReloadKey((k) => k + 1)} />}
            <p className="text-xs text-muted-foreground">Marking a class register also counts as being in school, even if you have not scanned.</p>
          </section>
          <section className="overflow-hidden rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 font-heading text-lg font-semibold sm:px-5">Upcoming duties</h2>
            {duties.length === 0 ? <Empty>No duties assigned.</Empty> : (
              <ul className="divide-y">
                {duties.map((d) => (
                  <li key={d.id} className="px-4 py-3 text-sm sm:px-5"><p className="font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{fmtDay(d.date)}{d.start_time ? ` · ${d.start_time.slice(0, 5)}–${d.end_time?.slice(0, 5) ?? ""}` : ""}</p></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {tab === "summary" && <SummaryTab isAdmin={false} />}
      {tab === "leave" && <LeaveTab people={[]} isAdmin={false} openDialog={() => undefined} reloadKey={0} />}
    </div>
  );
}

export default function StaffAttendancePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";

  useEffect(() => {
    if (!loading && user && !EMPLOYEE_ROLES.includes(user.role) && user.role !== "group_principal") router.replace("/dashboard");
  }, [loading, user, router]);

  if (loading || !user) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Staff Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Who was expected, who came, and who was away and why." : "Clock in, see your attendance and leave, and your upcoming duties."}</p>
      </header>
      {isAdmin ? <AdminView /> : <MyView />}
    </div>
  );
}
