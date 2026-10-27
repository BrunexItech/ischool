"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bus, CheckCircle2, ChevronLeft, ChevronRight, Clock, Phone, Plus, Search, ShieldAlert, UserCheck } from "lucide-react";
import { api, ApiError, RunDetail, RunSummary, SchoolClass, Student, TransportOverview, TransportRoute, Vehicle } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { ClassStudentPicker } from "@/components/ClassStudentPicker";
import { LEVEL_BAR, LEVEL_LABEL, LEVEL_ORDER, Meter, Pill } from "@/components/oversight";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "—");
const DIRECTION = { morning: "Morning run · to school", afternoon: "Afternoon run · going home" } as const;
const STATUS_TONE = { not_started: "muted", in_progress: "info", completed: "good" } as const;
const STATUS_LABEL = { not_started: "Not started", in_progress: "On the road", completed: "Completed" } as const;
const ROW_TONE = { pending: "muted", boarded: "info", dropped: "good", absent: "warn" } as const;

function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  return Math.round((new Date(date + "T12:00:00").getTime() - Date.now()) / 86400000);
}

function Paper({ label, date }: { label: string; date: string | null | undefined }) {
  const d = daysUntil(date);
  if (d === null) return <span className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">{label}: not recorded</span>;
  const tone = d < 0 ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : d <= 30 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  return <span className={`rounded-md px-2 py-1 text-xs font-medium ${tone}`}>{label}: {d < 0 ? `expired ${-d} d ago` : `${new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}</span>;
}

/* ---------- Attendant ---------- */

export function AttendantRuns({ schoolId }: { schoolId: number }) {
  const { token } = useAuth();
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [open, setOpen] = useState<RunDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [handing, setHanding] = useState<{ id: number; who: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.listRuns(token, schoolId).then((r) => !cancelled && setRuns(r)).catch(() => !cancelled && setRuns([]));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, version]);

  async function start(r: RunSummary) {
    if (!token) return;
    setBusy(`${r.route_id}-${r.direction}`);
    try {
      setOpen(r.run_id ? await api.getRun(token, schoolId, r.run_id) : await api.startRun(token, schoolId, r.route_id, r.direction));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't open that run.");
    } finally {
      setBusy(null);
    }
  }

  async function mark(studentId: number, status: string, handedTo?: string) {
    if (!token || !open?.summary.run_id) return;
    setBusy(`s${studentId}`);
    try {
      setOpen(await api.markRunStudent(token, schoolId, open.summary.run_id, studentId, { status, handed_to: handedTo }));
      setHanding(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save that.");
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    if (!token || !open?.summary.run_id) return;
    setBusy("finish");
    try {
      setOpen(await api.completeRun(token, schoolId, open.summary.run_id));
      toast.success("Run completed");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't complete the run.");
    } finally {
      setBusy(null);
    }
  }

  if (!runs) return <PageLoader />;

  if (open) {
    const s = open.summary;
    const morning = s.direction === "morning";
    const done = s.status === "completed";
    const accounted = s.boarded + s.dropped + s.absent;
    return (
      <div className="flex flex-col gap-4 pb-24">
        <button type="button" onClick={() => { setOpen(null); setVersion((v) => v + 1); }} className="flex w-fit items-center gap-1 text-sm font-medium text-primary"><ChevronLeft className="size-4" /> All runs</button>
        <header className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{DIRECTION[s.direction]}</p>
          <h2 className="font-heading text-xl font-semibold">{s.route_name}</h2>
          <p className="text-sm text-muted-foreground">{s.vehicle_registration ?? "No vehicle"} · {s.driver_name ?? "No driver"}</p>
          <div className="mt-3"><Meter value={accounted} total={Math.max(1, s.expected)} label="Children accounted for" /></div>
          <p className="mt-1.5 text-sm"><strong>{s.boarded}</strong> on board · <strong>{s.dropped}</strong> {morning ? "at school" : "handed over"} · <strong>{s.absent}</strong> absent · <strong>{s.pending}</strong> waiting</p>
        </header>
        <ul className="flex flex-col gap-2">
          {open.rows.map((r, i) => {
            const newStop = i === 0 || open.rows[i - 1].stop_name !== r.stop_name;
            return (
              <li key={r.student_id}>
                {newStop && <p className="mt-2 mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><Bus className="size-3.5" aria-hidden /> {r.stop_name ?? "No stop set"}{r.stop_time ? ` · ${hhmm(r.stop_time)}` : ""}</p>}
                <div className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.class_name ?? "No class"}{r.guardian_phone ? <> · <a href={`tel:${r.guardian_phone}`} className="inline-flex items-center gap-1 text-primary"><Phone className="size-3" />{r.guardian_phone}</a></> : null}</p>
                    </div>
                    <Pill tone={ROW_TONE[r.status]}>{r.status === "pending" ? "Waiting" : r.status === "boarded" ? `On board${r.boarded_at ? ` ${time(r.boarded_at)}` : ""}` : r.status === "dropped" ? (morning ? "At school" : "Handed over") : "Absent"}</Pill>
                  </div>
                  {r.handed_to && <p className="mt-1 text-xs text-muted-foreground">Handed to {r.handed_to}{r.dropped_at ? ` at ${time(r.dropped_at)}` : ""}</p>}
                  {!done && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.status === "pending" && (
                        <>
                          <Button className="h-12 flex-1 text-base" disabled={busy === `s${r.student_id}`} onClick={() => mark(r.student_id, "boarded")}><UserCheck /> {morning ? "Picked up" : "On board"}</Button>
                          <Button variant="outline" className="h-12" disabled={busy === `s${r.student_id}`} onClick={() => mark(r.student_id, "absent")}>Absent</Button>
                        </>
                      )}
                      {r.status === "boarded" && !morning && handing?.id !== r.student_id && (
                        <Button className="h-12 flex-1 text-base" onClick={() => setHanding({ id: r.student_id, who: "" })}><CheckCircle2 /> Hand over</Button>
                      )}
                      {r.status === "boarded" && (
                        <Button variant="ghost" className="h-12" disabled={busy === `s${r.student_id}`} onClick={() => mark(r.student_id, "pending")}>Undo</Button>
                      )}
                      {r.status === "absent" && <Button variant="outline" className="h-12" onClick={() => mark(r.student_id, "pending")}>Undo absent</Button>}
                      {handing?.id === r.student_id && (
                        <form className="flex w-full flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); mark(r.student_id, "dropped", handing.who); }}>
                          <Input autoFocus required value={handing.who} onChange={(e) => setHanding({ id: r.student_id, who: e.target.value })} placeholder="Who received the child? e.g. Mother, Mrs Wanjiru" className="h-12" aria-label="Who received the child" />
                          <div className="flex gap-2"><Button type="submit" className="h-12 flex-1" disabled={!handing.who.trim() || busy === `s${r.student_id}`}>Confirm</Button><Button type="button" variant="outline" className="h-12" onClick={() => setHanding(null)}>Cancel</Button></div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {open.rows.length === 0 && <li className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">No learners are assigned to this route.</li>}
        </ul>
        {!done && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
            <Button className="mx-auto flex h-12 w-full max-w-xl text-base" disabled={busy === "finish"} onClick={finish}>{busy === "finish" && <Spinner size={16} className="text-current" />} {morning ? "Arrived at school: complete run" : "Complete run"}</Button>
          </div>
        )}
        {done && <p className="rounded-xl border bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">This run is complete.{s.completed_at ? ` Finished at ${time(s.completed_at)}.` : ""}</p>}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
        <Bus className="size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">No vehicle is assigned to you yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">The transport office assigns you to a vehicle. Once they do, today&apos;s runs appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {runs.map((r) => (
        <button key={`${r.route_id}-${r.direction}`} type="button" onClick={() => start(r)} disabled={busy === `${r.route_id}-${r.direction}`} className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-start justify-between gap-2">
            <span><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{DIRECTION[r.direction]}</span><span className="block font-heading text-lg font-semibold">{r.route_name}</span></span>
            <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
          </span>
          <span className="text-sm text-muted-foreground">{r.vehicle_registration} · {r.expected} learner{r.expected === 1 ? "" : "s"}{r.due_time ? ` · ${r.direction === "morning" ? "due at school" : "leaves school"} ${hhmm(r.due_time)}` : ""}</span>
          {r.status !== "not_started" && <Meter value={r.boarded + r.dropped + r.absent} total={Math.max(1, r.expected)} label="Progress" />}
          <span className="text-sm font-medium text-primary">{r.status === "not_started" ? "Start run" : r.status === "in_progress" ? "Continue" : "View"}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Runs board ---------- */

export function RunsBoard({ runs, schoolId }: { runs: RunSummary[]; schoolId: number }) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<RunDetail | null>(null);

  async function show(r: RunSummary) {
    if (!token || !r.run_id) return;
    try {
      setDetail(await api.getRun(token, schoolId, r.run_id));
    } catch {
      toast.error("We couldn't open that run.");
    }
  }

  if (runs.length === 0) return <p className="rounded-xl border border-dashed bg-card px-4 py-12 text-center text-sm text-muted-foreground">No routes are set up yet.</p>;
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {runs.map((r) => (
          <li key={`${r.route_id}-${r.direction}`}>
            <button type="button" disabled={!r.run_id} onClick={() => show(r)} className="flex h-full w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors enabled:hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0"><span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{r.direction === "morning" ? "Morning · to school" : "Afternoon · going home"}</span><span className="block font-medium break-words">{r.route_name}</span></span>
                <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
              </span>
              <span className="text-xs text-muted-foreground">{r.vehicle_registration ?? "No vehicle"} · {r.driver_name ?? "No driver"} · {r.attendant_name ? `Attendant ${r.attendant_name}` : "No attendant"}</span>
              <Meter value={r.boarded + r.dropped + r.absent} total={Math.max(1, r.expected)} label="Children accounted for" />
              <span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground"><span>{r.expected} expected</span><span>{r.boarded} on board</span><span>{r.dropped} {r.direction === "morning" ? "at school" : "handed over"}</span><span>{r.absent} absent</span></span>
              {(r.started_at || r.due_time) && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" aria-hidden />{r.started_at ? `Started ${time(r.started_at)}` : ""}{r.completed_at ? ` · finished ${time(r.completed_at)}` : ""}{!r.started_at && r.due_time ? `Due ${hhmm(r.due_time)}` : ""}</span>}
            </button>
          </li>
        ))}
      </ul>
      {detail && (
        <Dialog open onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader><DialogTitle>{detail.summary.route_name}, {detail.summary.direction} run</DialogTitle></DialogHeader>
            <ul className="divide-y rounded-lg border">
              {detail.rows.map((r) => (
                <li key={r.student_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block font-medium break-words">{r.name}</span><span className="block text-xs text-muted-foreground">{r.stop_name ?? "No stop"}{r.handed_to ? ` · handed to ${r.handed_to}` : ""}</span></span>
                  <Pill tone={ROW_TONE[r.status]}>{r.status === "pending" ? "Waiting" : r.status === "boarded" ? `On board${r.boarded_at ? ` ${time(r.boarded_at)}` : ""}` : r.status === "dropped" ? `${detail.summary.direction === "morning" ? "At school" : "Home"}${r.dropped_at ? ` ${time(r.dropped_at)}` : ""}` : "Absent"}</Pill>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/* ---------- Head: how every child arrived and left ---------- */

export function ClassMovement({ schoolId, classes }: { schoolId: number; classes: SchoolClass[] }) {
  const { token } = useAuth();
  const today = localDateStr();
  const [date, setDate] = useState(today);
  const [classId, setClassId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ key: string; value: TransportOverview | null } | null>(null);
  const key = `${date}|${classId}`;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.getTransportOverview(token, schoolId, { on: date, class_id: classId === "all" ? undefined : Number(classId) }).then((value) => !cancelled && setData({ key, value })).catch(() => !cancelled && setData({ key, value: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, date, classId, key]);

  const ready = data && data.key === key ? data.value : undefined;
  const q = query.trim().toLowerCase();
  const grouped = useMemo(() => {
    const out: Record<string, TransportOverview["classes"]> = {};
    for (const c of ready?.classes ?? []) (out[c.level] ??= []).push(c);
    return out;
  }, [ready]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-end gap-1.5">
          <Button variant="outline" size="icon" className="size-10" aria-label="Previous day" onClick={() => setDate(addDaysStr(date, -1))}><ChevronLeft /></Button>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Date<Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="h-10 w-44" /></label>
          <Button variant="outline" size="icon" className="size-10" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDaysStr(date, 1))}><ChevronRight /></Button>
          {date !== today && <Button variant="ghost" className="h-10" onClick={() => setDate(today)}>Today</Button>}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 min-w-44 rounded-lg border bg-background px-3 text-sm text-foreground">
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="relative sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a learner..." aria-label="Find a learner" className="h-10 pl-8" /></div>
      </div>

      {ready === undefined ? (
        <PageLoader />
      ) : ready === null ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">We couldn&apos;t load that day.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Day summary">
            {[
              ["Arrived at school", `${ready.summary.arrived}/${ready.summary.learners}`, "with an arrival record"],
              ["Left school", `${ready.summary.left}/${ready.summary.learners}`, "with a departure record"],
              ["Bus riders", String(ready.summary.bus_riders), "assigned to a route"],
              ["Bus runs", `${ready.summary.runs_completed}/${ready.summary.runs_total}`, ready.summary.runs_in_progress ? `${ready.summary.runs_in_progress} on the road` : "completed"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border bg-card p-3.5 sm:p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="font-heading text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
            ))}
          </section>
          {!ready.school_day && <p className="rounded-xl border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">This was not a school day, so records are not expected.</p>}
          {LEVEL_ORDER.filter((l) => grouped[l]).map((l) => (
            <section key={l} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><span className={`h-3 w-1 rounded-full ${LEVEL_BAR[l]}`} />{LEVEL_LABEL[l]}</h3>
              {grouped[l].map((c) => {
                const rows = c.rows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.admission_number.toLowerCase().includes(q));
                if (q && rows.length === 0) return null;
                return (
                  <div key={c.class_id} className="overflow-hidden rounded-xl border bg-card">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                      <h4 className="font-heading text-base font-semibold">{c.class_name}</h4>
                      <span className="text-xs text-muted-foreground tabular-nums">{c.arrived}/{c.learners} arrived · {c.left}/{c.learners} left · {c.bus_riders} on the bus</span>
                    </header>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[40rem] text-sm">
                        <thead><tr className="border-b text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"><th scope="col" className="px-4 py-2">Learner</th><th scope="col" className="px-3 py-2">Arrived at school</th><th scope="col" className="px-3 py-2">Left school</th><th scope="col" className="px-4 py-2">On the bus route</th></tr></thead>
                        <tbody className="divide-y">
                          {rows.map((r) => (
                            <tr key={r.student_id} className="align-top">
                              <th scope="row" className="px-4 py-2 text-left font-normal"><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.admission_number}{r.bus_rider ? " · bus rider" : ""}</span></th>
                              {[r.arrival, r.departure].map((e, i) => (
                                <td key={i} className="px-3 py-2">{e ? <><span className="block tabular-nums">{time(e.at)} <Pill tone={e.via === "bus" ? "info" : e.via === "parent" ? "brand" : "muted"}>{e.via === "bus" ? "Bus" : e.via === "parent" ? "Parent" : "Gate"}</Pill></span><span className="block text-xs text-muted-foreground">{e.by}</span></> : <span className={ready.school_day ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>{ready.school_day ? "No record" : "—"}</span>}</td>
                              ))}
                              <td className="px-4 py-2 text-xs text-muted-foreground">{r.on_route.length ? r.on_route.map((e, i) => <span key={i} className="block">{time(e.at)} · {e.note ?? e.by}</span>) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          {ready.classes.length === 0 && <p className="rounded-xl border border-dashed bg-card px-4 py-12 text-center text-sm text-muted-foreground">No classes to show.</p>}
        </>
      )}
    </div>
  );
}

/* ---------- Fleet ---------- */

function VehicleDialog({ vehicle, attendants, onClose, onSaved }: { vehicle: Vehicle | null; attendants: { user_id: number; full_name: string }[]; onClose: () => void; onSaved: (v: Vehicle) => void }) {
  const { token, user } = useAuth();
  const [f, setF] = useState({
    registration_number: vehicle?.registration_number ?? "",
    capacity: vehicle ? String(vehicle.capacity) : "",
    vehicle_type: vehicle?.vehicle_type ?? "bus",
    make_model: vehicle?.make_model ?? "",
    driver_name: vehicle?.driver_name ?? "",
    driver_phone: vehicle?.driver_phone ?? "",
    attendant: vehicle?.attendant_user_id ? String(vehicle.attendant_user_id) : "none",
    insurance_expiry: vehicle?.insurance_expiry ?? "",
    inspection_expiry: vehicle?.inspection_expiry ?? "",
    next_service_date: vehicle?.next_service_date ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      const body = {
        capacity: Number(f.capacity),
        driver_name: f.driver_name,
        driver_phone: f.driver_phone,
        vehicle_type: f.vehicle_type,
        make_model: f.make_model || undefined,
        insurance_expiry: f.insurance_expiry || undefined,
        inspection_expiry: f.inspection_expiry || undefined,
        next_service_date: f.next_service_date || undefined,
        attendant_user_id: f.attendant === "none" ? undefined : Number(f.attendant),
      };
      const saved = vehicle
        ? await api.updateVehicle(token, user.school_id, vehicle.id, { ...body, attendant_user_id: f.attendant === "none" ? null : Number(f.attendant) })
        : await api.createVehicle(token, user.school_id, { registration_number: f.registration_number, ...body });
      toast.success(vehicle ? "Vehicle updated" : `${saved.registration_number} added`);
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, node: React.ReactNode) => <div className="flex flex-col gap-1.5"><Label>{label}</Label>{node}</div>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{vehicle ? `Edit ${vehicle.registration_number}` : "Add a vehicle"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {field("Registration", <Input required disabled={!!vehicle} value={f.registration_number} onChange={set("registration_number")} placeholder="KDA 123X" className="h-10" />)}
          {field("Seats", <Input required type="number" min={1} value={f.capacity} onChange={set("capacity")} className="h-10" />)}
          {field("Type", <select value={f.vehicle_type} onChange={(e) => setF((x) => ({ ...x, vehicle_type: e.target.value }))} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="bus">Bus</option><option value="van">Van / matatu</option><option value="minibus">Minibus</option><option value="car">Car</option></select>)}
          {field("Make and model", <Input value={f.make_model} onChange={set("make_model")} placeholder="Isuzu NQR" className="h-10" />)}
          {field("Driver", <Input required value={f.driver_name} onChange={set("driver_name")} className="h-10" />)}
          {field("Driver phone", <Input required value={f.driver_phone} onChange={set("driver_phone")} className="h-10" />)}
          <div className="sm:col-span-2">
            {field("Attendant who rides along", (
              <Select value={f.attendant} onValueChange={(v) => v && setF((x) => ({ ...x, attendant: v }))}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No attendant yet</SelectItem>{attendants.map((a) => <SelectItem key={a.user_id} value={String(a.user_id)}>{a.full_name}</SelectItem>)}</SelectContent>
              </Select>
            ))}
            {attendants.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Add a staff account with the role &ldquo;Transport attendant&rdquo; to choose one here.</p>}
          </div>
          {field("Insurance expires", <Input type="date" value={f.insurance_expiry} onChange={set("insurance_expiry")} className="h-10" />)}
          {field("Inspection expires", <Input type="date" value={f.inspection_expiry} onChange={set("inspection_expiry")} className="h-10" />)}
          {field("Next service", <Input type="date" value={f.next_service_date} onChange={set("next_service_date")} className="h-10" />)}
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-11 sm:h-9" disabled={saving}>{saving && <Spinner size={16} className="text-current" />} {vehicle ? "Save changes" : "Add vehicle"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FleetPanel({ schoolId, vehicles, setVehicles, alerts, canManage }: { schoolId: number; vehicles: Vehicle[]; setVehicles: (fn: (v: Vehicle[]) => Vehicle[]) => void; alerts: TransportOverview["fleet_alerts"]; canManage: boolean }) {
  const { token } = useAuth();
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const [attendants, setAttendants] = useState<{ user_id: number; full_name: string }[]>([]);

  useEffect(() => {
    if (!token || !canManage) return;
    api.listAttendants(token, schoolId).then(setAttendants).catch(() => setAttendants([]));
  }, [token, schoolId, canManage]);

  return (
    <div className="flex flex-col gap-4">
      {alerts.length > 0 && (
        <section className="rounded-xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-950/30" aria-label="Fleet alerts">
          <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="size-4 text-amber-700 dark:text-amber-400" aria-hidden /> Needs attention</p>
          <ul className="flex flex-col gap-0.5 text-sm">{alerts.slice(0, 8).map((a, i) => <li key={i} className={a.urgent ? "font-medium text-red-700 dark:text-red-400" : ""}>{a.vehicle}: {a.text}</li>)}</ul>
        </section>
      )}
      {canManage && <div><Button className="h-10 sm:h-9" onClick={() => setEditing("new")}><Plus /> Add vehicle</Button></div>}
      {vehicles.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-12 text-center text-sm text-muted-foreground">No vehicles yet.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-heading text-lg font-semibold">{v.registration_number}</p><p className="text-xs text-muted-foreground capitalize">{v.vehicle_type ?? "bus"}{v.make_model ? ` · ${v.make_model}` : ""}</p></div>
                <Pill tone={v.is_active ? "good" : "muted"}>{v.is_active ? "In service" : "Off the road"}</Pill>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Seats</dt><dd className="tabular-nums">{v.capacity}{v.assigned_learners != null ? ` · ${v.assigned_learners} learners assigned` : ""}</dd>
                <dt className="text-muted-foreground">Driver</dt><dd className="break-words">{v.driver_name} · <a href={`tel:${v.driver_phone}`} className="text-primary">{v.driver_phone}</a></dd>
                <dt className="text-muted-foreground">Attendant</dt><dd>{v.attendant_name ?? <span className="text-amber-700 dark:text-amber-400">None assigned</span>}</dd>
              </dl>
              {v.assigned_learners != null && v.assigned_learners > v.capacity && <p className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400"><AlertTriangle className="size-3.5" aria-hidden /> More learners assigned than seats</p>}
              <div className="flex flex-wrap gap-1.5"><Paper label="Insurance" date={v.insurance_expiry} /><Paper label="Inspection" date={v.inspection_expiry} /><Paper label="Service" date={v.next_service_date} /></div>
              {canManage && <Button variant="outline" size="sm" className="h-9 w-fit" onClick={() => setEditing(v)}>Edit</Button>}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <VehicleDialog
          key={editing === "new" ? "new" : editing.id}
          vehicle={editing === "new" ? null : editing}
          attendants={attendants}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setVehicles((all) => (all.some((x) => x.id === saved.id) ? all.map((x) => (x.id === saved.id ? saved : x)) : [...all, saved]));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Routes ---------- */

function AddStopForm({ routeId, schoolId, onAdded }: { routeId: number; schoolId: number; onAdded: (route: TransportRoute) => void }) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [pickup, setPickup] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      onAdded(await api.addRouteStop(token, schoolId, routeId, { name, stop_order: 999, pickup_time: pickup || undefined }));
      setName("");
      setPickup("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't add the stop.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <Input required placeholder="New stop" value={name} onChange={(e) => setName(e.target.value)} aria-label="Stop name" className="h-9 w-40" />
      <Input type="time" value={pickup} onChange={(e) => setPickup(e.target.value)} aria-label="Pick-up time" className="h-9 w-32" />
      <Button size="sm" type="submit" className="h-9" disabled={busy}>Add stop</Button>
    </form>
  );
}

export function RoutesPanel({ schoolId, routes, setRoutes, vehicles, students, classes, canManage }: { schoolId: number; routes: TransportRoute[]; setRoutes: (fn: (r: TransportRoute[]) => TransportRoute[]) => void; vehicles: Vehicle[]; students: Student[]; classes: SchoolClass[]; canManage: boolean }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ name: "", vehicle: "none", arrive: "", leave: "" });
  const [assign, setAssign] = useState({ student: "", route: "", stop: "none" });
  const [busy, setBusy] = useState<"route" | "assign" | null>(null);
  const stops = routes.find((r) => String(r.id) === assign.route)?.stops ?? [];

  async function addRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy("route");
    try {
      const created = await api.createTransportRoute(token, schoolId, { name: form.name, vehicle_id: form.vehicle === "none" ? undefined : Number(form.vehicle), school_arrival_time: form.arrive || undefined, afternoon_departure_time: form.leave || undefined });
      setRoutes((r) => [...r, created]);
      setForm({ name: "", vehicle: "none", arrive: "", leave: "" });
      toast.success(`${created.name} added`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't add the route.");
    } finally {
      setBusy(null);
    }
  }

  async function assignStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !assign.student || !assign.route) return;
    setBusy("assign");
    try {
      await api.assignStudentTransport(token, schoolId, Number(assign.student), { transport_route_id: Number(assign.route), transport_stop_id: assign.stop === "none" ? null : Number(assign.stop) });
      toast.success("Learner assigned to the route");
      setAssign({ student: "", route: "", stop: "none" });
      setRoutes((rs) => rs.map((r) => (String(r.id) === assign.route ? { ...r, learners: (r.learners ?? 0) + 1 } : r)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't assign the learner.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="grid gap-4 xl:grid-cols-2">
          <form onSubmit={addRoute} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h3 className="font-heading text-base font-semibold">Add a route</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input required placeholder="Route name, e.g. Westlands" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 sm:col-span-2" />
              <Select value={form.vehicle} onValueChange={(v) => v && setForm((f) => ({ ...f, vehicle: v }))}><SelectTrigger className="h-10 w-full sm:col-span-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No vehicle yet</SelectItem>{vehicles.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.registration_number}</SelectItem>)}</SelectContent></Select>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">Due at school (morning)<Input type="time" value={form.arrive} onChange={(e) => setForm((f) => ({ ...f, arrive: e.target.value }))} className="h-10" /></label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">Leaves school (afternoon)<Input type="time" value={form.leave} onChange={(e) => setForm((f) => ({ ...f, leave: e.target.value }))} className="h-10" /></label>
            </div>
            <Button type="submit" className="h-10 w-fit" disabled={busy === "route"}><Plus /> Add route</Button>
          </form>
          <form onSubmit={assignStudent} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h3 className="font-heading text-base font-semibold">Put a learner on a route</h3>
            <div className="flex flex-wrap items-end gap-3">
              <ClassStudentPicker classes={classes} students={students} value={assign.student} onChange={(v) => setAssign((a) => ({ ...a, student: v }))} />
              <Select value={assign.route} onValueChange={(v) => v && setAssign((a) => ({ ...a, route: v, stop: "none" }))}><SelectTrigger className="h-10 w-44"><SelectValue placeholder="Route" /></SelectTrigger><SelectContent>{routes.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent></Select>
              <Select value={assign.stop} onValueChange={(v) => v && setAssign((a) => ({ ...a, stop: v }))}><SelectTrigger className="h-10 w-40"><SelectValue placeholder="Stop" /></SelectTrigger><SelectContent><SelectItem value="none">No specific stop</SelectItem>{stops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button type="submit" className="h-10 w-fit" disabled={busy === "assign" || !assign.student || !assign.route}>Assign</Button>
          </form>
        </div>
      )}
      {routes.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-12 text-center text-sm text-muted-foreground">No routes yet.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {routes.map((route) => {
            const v = vehicles.find((x) => x.id === route.vehicle_id);
            const over = v && (route.learners ?? 0) > v.capacity;
            return (
              <li key={route.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-heading text-lg font-semibold break-words">{route.name}</p><p className="text-xs text-muted-foreground">{v ? `${v.registration_number} · ${v.driver_name}${v.attendant_name ? ` · attendant ${v.attendant_name}` : ""}` : "No vehicle assigned"}</p></div>
                  <Pill tone={over ? "bad" : "muted"}>{route.learners ?? 0} learner{(route.learners ?? 0) === 1 ? "" : "s"}</Pill>
                </div>
                <p className="text-xs text-muted-foreground">Due at school {hhmm(route.school_arrival_time)} · leaves school {hhmm(route.afternoon_departure_time)}</p>
                <ol className="flex flex-col gap-1 border-l-2 pl-3">
                  {route.stops.map((s) => <li key={s.id} className="flex justify-between gap-2 text-sm"><span className="break-words">{s.name}</span><span className="tabular-nums text-muted-foreground">{hhmm(s.pickup_time)}</span></li>)}
                  {route.stops.length === 0 && <li className="text-xs text-muted-foreground">No stops yet.</li>}
                </ol>
                {canManage && <AddStopForm routeId={route.id} schoolId={schoolId} onAdded={(updated) => setRoutes((all) => all.map((r) => (r.id === updated.id ? updated : r)))} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
