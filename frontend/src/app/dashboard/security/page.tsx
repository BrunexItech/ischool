"use client";

import { useModuleTab } from "@/lib/moduleTabs";
import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCircle2, Plus, LogOut as SignOutIcon, ShieldAlert, Search, Siren, XCircle } from "lucide-react";
import {
  api,
  ApiError,
  EarlyPickup,
  Exeat,
  IncidentSeverity,
  PatrolLogEntry,
  SchoolClass,
  SecurityAlert,
  SecurityIncident,
  Student,
  VehicleLogEntry,
  VehicleReleaseRequest,
  Visitor,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ClassStudentPicker } from "@/components/ClassStudentPicker";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const PURPOSES = ["Parent visit", "Delivery", "Meeting", "Contractor", "Interview", "Inspection", "Other"];
const INCIDENT_TYPES = ["Trespass", "Theft", "Vandalism", "Altercation", "Suspicious activity", "Other"];
const ALERT_TYPES = ["Lockdown", "Fire evacuation", "Medical emergency", "Intruder on site", "Severe weather", "Drill (practice)"];

function timeAgo(iso: string) {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.floor(mins)} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h ago`;
  return `${Math.floor(mins / 1440)} d ago`;
}

function AlertsBanner() {
  const { token, user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);

  const reload = () => {
    if (!token || !user?.school_id) return;
    api.listSecurityAlerts(token, user.school_id).then((a) => setAlerts(a.filter((x) => x.active)));
  };
  useEffect(reload, [token, user?.school_id]);

  async function standDown(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.standDownSecurityAlert(token, user.school_id, id);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to stand down alert");
    }
  }

  if (!alerts.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Siren className="size-4 text-destructive" />
            <p className="text-sm">
              <span className="font-semibold text-destructive">{a.type} alert active</span>{" "}
              <span className="text-muted-foreground">since {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {a.message}</span>
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => standDown(a.id)}>Stand down</Button>
        </div>
      ))}
    </div>
  );
}

function RaiseAlertDialog({ onRaised }: { onRaised: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: "Drill (practice)", message: "", sms_parents: false });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      await api.raiseSecurityAlert(token, user.school_id, form);
      toast.success(`${form.type} alert sent to all staff${form.sms_parents ? " and parents" : ""}`);
      setOpen(false);
      setForm({ type: "Drill (practice)", message: "", sms_parents: false });
      onRaised();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send alert");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive"><Bell />Raise alert</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Raise an emergency alert</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Sends an alert to every staff portal straight away.</p>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Alert</Label>
            <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ALERT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Instructions</Label>
            <Textarea required rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="e.g. Lock classrooms and keep learners inside" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.sms_parents} onChange={(e) => setForm((f) => ({ ...f, sms_parents: e.target.checked }))} />
            Also SMS parents
          </label>
          <Button disabled={submitting} type="submit" variant="destructive">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Sending..." : "Send alert"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckGatePassDialog() {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Exeat | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !code) return;
    setBusy(true);
    setNotFound(false);
    try {
      const exeat = await api.findExeatByGatePass(token, user.school_id, code.toUpperCase());
      setResult(exeat);
    } catch {
      setResult(null);
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: (t: string, s: number, id: number) => Promise<Exeat>, label: string) {
    if (!token || !user?.school_id || !result) return;
    try {
      const updated = await fn(token, user.school_id, result.id);
      setResult(updated);
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCode(""); setResult(null); setNotFound(false); } }}>
      <DialogTrigger render={<Button variant="outline"><Search />Check gate pass</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Check gate pass</DialogTitle></DialogHeader>
        <form onSubmit={check} className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="GP-4821" className="font-mono uppercase" />
          <Button type="submit" disabled={busy}>{busy && <Spinner size={16} className="text-current" />} Check</Button>
        </form>
        {notFound && <p className="text-sm text-destructive">No pass with this code. Do not release the learner — call the house parent.</p>}
        {result && (
          <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <p className="font-medium">{result.reason}</p>
            <p className="text-muted-foreground">
              Collected by {result.pickup_name}{result.pickup_relation ? ` (${result.pickup_relation})` : ""} · {result.from_date} → {result.to_date}
            </p>
            <Badge variant="outline" className="w-fit capitalize">{result.status.replace("_", " ")}</Badge>
            {result.status === "approved" && (
              <Button size="sm" onClick={() => act(api.checkOutExeat, "Confirmed exit")}>Confirm exit</Button>
            )}
            {result.status === "out" && (
              <Button size="sm" onClick={() => act(api.checkInExeat, "Confirmed return")}>Confirm return</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SignInVisitorDialog({ onSignedIn }: { onSignedIn: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", id_number: "", phone: "", purpose: "Parent visit", host_name: "", vehicle_registration: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const visitor = await api.signInVisitor(token, user.school_id, {
        ...form,
        vehicle_registration: form.vehicle_registration || undefined,
      });
      toast.success(`${visitor.name} signed in with badge ${visitor.badge}`);
      setOpen(false);
      setForm({ name: "", id_number: "", phone: "", purpose: "Parent visit", host_name: "", vehicle_registration: "" });
      onSignedIn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to sign in visitor");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />Sign in visitor</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Sign in visitor</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>Full name</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>National ID / passport</Label>
            <Input required minLength={6} value={form.id_number} onChange={(e) => setForm((f) => ({ ...f, id_number: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Phone</Label>
            <Input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Purpose</Label>
            <Select value={form.purpose} onValueChange={(v) => v && setForm((f) => ({ ...f, purpose: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Visiting</Label>
            <Input required value={form.host_name} onChange={(e) => setForm((f) => ({ ...f, host_name: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Vehicle registration (optional)</Label>
            <Input value={form.vehicle_registration} onChange={(e) => setForm((f) => ({ ...f, vehicle_registration: e.target.value.toUpperCase() }))} />
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Signing in..." : "Sign in and issue badge"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VisitorsTab() {
  const { token, user } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = () => {
    if (!token || !user?.school_id) return;
    api.listVisitors(token, user.school_id).then(setVisitors).finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function signOut(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.signOutVisitor(token, user.school_id, id);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to sign out visitor");
    }
  }

  if (loading) return <PageLoader />;
  const sorted = [...visitors].sort((a, b) => (a.signed_out_at ? 1 : 0) - (b.signed_out_at ? 1 : 0));
  const q = search.trim().toLowerCase();
  const filtered = sorted
    .filter((v) => !q || v.name.toLowerCase().includes(q) || v.badge.toLowerCase().includes(q) || v.host_name.toLowerCase().includes(q) || v.purpose.toLowerCase().includes(q) || (v.vehicle_registration ?? "").toLowerCase().includes(q))
    .filter((v) => !date || v.signed_in_at.slice(0, 10) === date);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, badge, host, or purpose..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        {date && <Button variant="ghost" size="sm" onClick={() => setDate("")}>Clear date</Button>}
      </div>
      {filtered.map((v) => (
        <Card key={v.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div>
              <p className="text-sm font-medium">{v.name} <span className="font-mono text-xs text-muted-foreground">{v.badge}</span></p>
              <p className="text-xs text-muted-foreground">{v.purpose} · visiting {v.host_name} · ID {v.id_number_masked}{v.vehicle_registration ? ` · ${v.vehicle_registration}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              {v.signed_out_at ? (
                <Badge variant="secondary">Signed out {timeAgo(v.signed_out_at)}</Badge>
              ) : (
                <>
                  <Badge variant="outline">On site</Badge>
                  <Button size="sm" variant="outline" onClick={() => signOut(v.id)}><SignOutIcon />Sign out</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {filtered.length === 0 && (
        <EmptyNote>{sorted.length === 0 ? "No visitors on record." : "No visitors match your search."}</EmptyNote>
      )}
    </div>
  );
}

function PassesTab() {
  const { token, user } = useAuth();
  const [exeats, setExeats] = useState<Exeat[]>([]);
  const [pickups, setPickups] = useState<EarlyPickup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ student_id: "", collected_by: "", relation: "Mother", reason: "" });
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const reload = () => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listExeats(token, user.school_id),
      api.listEarlyPickups(token, user.school_id),
      api.listStudents(token, user.school_id),
      api.listClasses(token, user.school_id),
    ])
      .then(([e, p, s, c]) => {
        setExeats(e.filter((x) => ["approved", "out", "returned", "returned_late"].includes(x.status)));
        setPickups(p);
        setStudents(s);
        setClasses(c);
      })
      .finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.student_id) return;
    setSubmitting(true);
    try {
      await api.logEarlyPickup(token, user.school_id, { ...form, student_id: Number(form.student_id) });
      toast.success("Learner released");
      setPickupOpen(false);
      setForm({ student_id: "", collected_by: "", relation: "Mother", reason: "" });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to log pick-up");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
          <DialogTrigger render={<Button variant="outline"><Plus />Day scholar early pick-up</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Day scholar early pick-up</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid gap-3 sm:grid-cols-2">
                <ClassStudentPicker
                  classes={classes}
                  students={students}
                  value={form.student_id}
                  onChange={(v) => setForm((f) => ({ ...f, student_id: v }))}
                  studentLabel="Learner"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Collected by</Label>
                <Input required value={form.collected_by} onChange={(e) => setForm((f) => ({ ...f, collected_by: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Relationship</Label>
                <Select value={form.relation} onValueChange={(v) => v && setForm((f) => ({ ...f, relation: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Mother", "Father", "Guardian", "Relative", "Driver", "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label>Reason</Label>
                <Input required value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Clinic appointment" />
              </div>
              <Button disabled={submitting} type="submit" className="col-span-2">
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Releasing..." : "Release learner"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Boarding gate passes</h3>
        <div className="flex flex-col gap-2">
          {exeats.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div>
                  <p className="text-sm font-medium font-mono">{e.gate_pass}</p>
                  <p className="text-xs text-muted-foreground">
                    {studentById.get(e.student_id) ? `${studentById.get(e.student_id)!.first_name} ${studentById.get(e.student_id)!.last_name}` : "—"} · collected by {e.pickup_name} · {e.from_date} → {e.to_date}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">{e.status.replace("_", " ")}</Badge>
              </CardContent>
            </Card>
          ))}
          {exeats.length === 0 && <EmptyNote>No active gate passes.</EmptyNote>}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Early pick-ups today</h3>
        <div className="flex flex-col gap-2">
          {pickups.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-3 pt-4">
                <div>
                  <p className="text-sm font-medium">{studentById.get(p.student_id) ? `${studentById.get(p.student_id)!.first_name} ${studentById.get(p.student_id)!.last_name}` : "—"}</p>
                  <p className="text-xs text-muted-foreground">Collected by {p.collected_by} ({p.relation}) · {p.reason}</p>
                </div>
                <Badge variant={p.verified ? "secondary" : "outline"}>{p.verified ? "Verified" : "Override"}</Badge>
              </CardContent>
            </Card>
          ))}
          {pickups.length === 0 && <p className="text-sm text-muted-foreground">None today.</p>}
        </div>
      </div>
    </div>
  );
}

function RequestReleaseDialog({ log, onRequested }: { log: VehicleLogEntry; onRequested: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState(log.purpose);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      await api.createVehicleReleaseRequest(token, user.school_id, {
        registration: log.registration,
        driver_name: log.driver_name,
        purpose,
      });
      toast.success(`Release requested for ${log.registration} — waiting on admin approval`);
      setOpen(false);
      onRequested();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to request release");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline"><SignOutIcon /> Request release</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Request release — {log.registration}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label>Purpose for leaving</Label>
            <Input required value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">An admin or supervisor needs to approve this before the gate log shows it as out.</p>
          <Button disabled={submitting} type="submit">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Sending..." : "Send for approval"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReleaseRequestsCard({ requests, canDecide, onDecided }: { requests: VehicleReleaseRequest[]; canDecide: boolean; onDecided: () => void }) {
  const { token, user } = useAuth();
  const [busyId, setBusyId] = useState<number | null>(null);

  async function decide(requestId: number, action: "approve" | "reject") {
    if (!token || !user?.school_id) return;
    setBusyId(requestId);
    try {
      if (action === "approve") await api.approveVehicleReleaseRequest(token, user.school_id, requestId);
      else await api.rejectVehicleReleaseRequest(token, user.school_id, requestId);
      toast.success(action === "approve" ? "Release approved" : "Release rejected");
      onDecided();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record decision");
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) return null;

  return (
    <Card className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/10">
      <CardContent className="flex flex-col gap-3 pt-4">
        <p className="text-sm font-semibold">Pending vehicle releases</p>
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
            <div>
              <p className="text-sm font-medium font-mono">{r.registration}</p>
              <p className="text-xs text-muted-foreground">{r.driver_name} · {r.purpose} · requested {new Date(r.requested_at).toLocaleString()}</p>
            </div>
            {canDecide ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => decide(r.id, "reject")}><XCircle /> Reject</Button>
                <Button size="sm" disabled={busyId === r.id} onClick={() => decide(r.id, "approve")}><CheckCircle2 /> Approve</Button>
              </div>
            ) : (
              <Badge variant="secondary">Awaiting admin</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function VehiclesTab() {
  const { token, user } = useAuth();
  const [logs, setLogs] = useState<VehicleLogEntry[]>([]);
  const [releaseRequests, setReleaseRequests] = useState<VehicleReleaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ registration: "", driver_name: "", purpose: "" });
  const [date, setDate] = useState("");

  const canDecide = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";

  const reload = () => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listVehicleLogs(token, user.school_id).then(setLogs),
      api.listVehicleReleaseRequests(token, user.school_id, "pending").then(setReleaseRequests),
    ]).finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      await api.logVehicle(token, user.school_id, { ...form, direction: "in", registration: form.registration.toUpperCase() });
      toast.success(`${form.registration.toUpperCase()} logged in`);
      setOpen(false);
      setForm({ registration: "", driver_name: "", purpose: "" });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to log vehicle");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader />;

  // Latest entry per registration tells us who's currently on the premises.
  const latestByRegistration = new Map<string, VehicleLogEntry>();
  for (const l of logs) {
    const existing = latestByRegistration.get(l.registration);
    if (!existing || new Date(l.logged_at) > new Date(existing.logged_at)) latestByRegistration.set(l.registration, l);
  }
  const pendingRegistrations = new Set(releaseRequests.map((r) => r.registration));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus />Log vehicle in</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Log vehicle in</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Registration</Label>
                <Input required className="uppercase" value={form.registration} onChange={(e) => setForm((f) => ({ ...f, registration: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Driver</Label>
                <Input required value={form.driver_name} onChange={(e) => setForm((f) => ({ ...f, driver_name: e.target.value }))} />
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label>Purpose</Label>
                <Input required value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
              </div>
              <Button disabled={submitting} type="submit" className="col-span-2">
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Logging..." : "Log in"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ReleaseRequestsCard requests={releaseRequests} canDecide={canDecide} onDecided={reload} />

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        {date && <Button variant="ghost" size="sm" onClick={() => setDate("")}>Clear date</Button>}
      </div>

      <div className="flex flex-col gap-2">
        {logs.filter((l) => !date || l.logged_at.slice(0, 10) === date).map((l) => {
          const isCurrentlyIn = l.direction === "in" && latestByRegistration.get(l.registration)?.id === l.id;
          const hasPendingRelease = pendingRegistrations.has(l.registration);
          return (
            <Card key={l.id}>
              <CardContent className="flex items-center justify-between gap-3 pt-4">
                <div>
                  <p className="text-sm font-medium font-mono">{l.registration}</p>
                  <p className="text-xs text-muted-foreground">{l.driver_name} · {l.purpose} · {new Date(l.logged_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isCurrentlyIn && !hasPendingRelease && <RequestReleaseDialog log={l} onRequested={reload} />}
                  {isCurrentlyIn && hasPendingRelease && <Badge variant="secondary">Release pending</Badge>}
                  <Badge variant={l.direction === "in" ? "secondary" : "outline"} className="capitalize">{l.direction}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {logs.filter((l) => !date || l.logged_at.slice(0, 10) === date).length === 0 && <EmptyNote>No vehicle movements for that filter.</EmptyNote>}
      </div>
    </div>
  );
}

function IncidentsTab() {
  const { token, user } = useAuth();
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: "Trespass", location: "", severity: "low" as IncidentSeverity, description: "", action_taken: "" });

  const reload = () => {
    if (!token || !user?.school_id) return;
    api.listSecurityIncidents(token, user.school_id).then(setIncidents).finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      await api.reportSecurityIncident(token, user.school_id, form);
      toast.success(`Incident reported${form.severity !== "low" ? "; the principal has been alerted" : ""}`);
      setOpen(false);
      setForm({ type: "Trespass", location: "", severity: "low", description: "", action_taken: "" });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to report incident");
    } finally {
      setSubmitting(false);
    }
  }

  async function close(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.closeSecurityIncident(token, user.school_id, id);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to close incident");
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><ShieldAlert />Report incident</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Report incident</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{INCIDENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Where</Label>
                <Input required value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => v && setForm((f) => ({ ...f, severity: v as IncidentSeverity }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div />
              <div className="col-span-2 grid gap-1.5">
                <Label>What happened</Label>
                <Textarea required rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label>Action taken</Label>
                <Input required value={form.action_taken} onChange={(e) => setForm((f) => ({ ...f, action_taken: e.target.value }))} />
              </div>
              <Button disabled={submitting} type="submit" className="col-span-2">
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Reporting..." : "Report"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-col gap-2">
        {incidents.map((i) => (
          <Card key={i.id}>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <div>
                <p className="text-sm font-medium">{i.type} · {i.location}</p>
                <p className="text-xs text-muted-foreground">{i.description}</p>
                <p className="text-xs text-muted-foreground">Action: {i.action_taken}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={i.severity === "high" ? "destructive" : i.severity === "medium" ? "outline" : "secondary"} className="capitalize">{i.severity}</Badge>
                <Badge variant={i.status === "open" ? "destructive" : "secondary"} className="capitalize">{i.status}</Badge>
                {i.status === "open" && <Button size="sm" variant="outline" onClick={() => close(i.id)}>Close</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {incidents.length === 0 && <EmptyNote>No incidents recorded.</EmptyNote>}
      </div>
    </div>
  );
}

function PatrolsTab() {
  const { token, user } = useAuth();
  const [patrols, setPatrols] = useState<PatrolLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ post: "Dormitories patrol", ok: "1", note: "All clear." });

  const reload = () => {
    if (!token || !user?.school_id) return;
    api.listPatrolLogs(token, user.school_id).then(setPatrols).finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      await api.logPatrol(token, user.school_id, { post: form.post, ok: form.ok === "1", note: form.note });
      toast.success("Patrol logged");
      setOpen(false);
      setForm({ post: "Dormitories patrol", ok: "1", note: "All clear." });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to log patrol");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus />Log patrol</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Log patrol check</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Post</Label>
                <Input required value={form.post} onChange={(e) => setForm((f) => ({ ...f, post: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Result</Label>
                <Select value={form.ok} onValueChange={(v) => v && setForm((f) => ({ ...f, ok: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">All clear</SelectItem>
                    <SelectItem value="0">Issue found</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Notes</Label>
                <Input required value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
              <Button disabled={submitting} type="submit">
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Logging..." : "Log"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-col gap-2">
        {patrols.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <div>
                <p className="text-sm font-medium">{p.post}</p>
                <p className="text-xs text-muted-foreground">{p.note} · {new Date(p.created_at).toLocaleString()}</p>
              </div>
              <Badge variant={p.ok ? "secondary" : "destructive"}>{p.ok ? "All clear" : "Issue"}</Badge>
            </CardContent>
          </Card>
        ))}
        {patrols.length === 0 && <EmptyNote>No patrols logged.</EmptyNote>}
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const { user, loading } = useAuth();
  const urlTab = useModuleTab("security");   // set only for staff whose sections live in the sidebar
  const [refreshKey, setRefreshKey] = useState(0);
  if (loading) return <PageLoader />;
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Security"
        description="Gate and compound security — visitors, gate passes, vehicles, incidents and patrols."
        action={
          <div className="flex flex-wrap gap-2">
            <RaiseAlertDialog onRaised={() => setRefreshKey((k) => k + 1)} />
            <CheckGatePassDialog />
            <SignInVisitorDialog onSignedIn={() => setRefreshKey((k) => k + 1)} />
          </div>
        }
      />

      <AlertsBanner key={`alerts-${refreshKey}`} />

      <Tabs {...(urlTab ? { value: urlTab } : { defaultValue: "visitors" })}>
        <TabsList className={urlTab ? "hidden" : undefined}>
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
          <TabsTrigger value="passes">Gate passes &amp; pick-ups</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="patrols">Patrols</TabsTrigger>
        </TabsList>
        <TabsContent value="visitors"><VisitorsTab key={`visitors-${refreshKey}`} /></TabsContent>
        <TabsContent value="passes"><PassesTab /></TabsContent>
        <TabsContent value="vehicles"><VehiclesTab /></TabsContent>
        <TabsContent value="incidents"><IncidentsTab /></TabsContent>
        <TabsContent value="patrols"><PatrolsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
