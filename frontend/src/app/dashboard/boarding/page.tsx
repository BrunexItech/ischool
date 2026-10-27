"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, DoorOpen, LogIn, Check, X, Stethoscope, ShieldAlert } from "lucide-react";
import {
  api,
  ApiError,
  BoardingAssignment,
  BoardingHouse,
  BoardingIncident,
  Exeat,
  RollSession,
  SchoolClass,
  SickBayVisit,
  Student,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ClassStudentPicker } from "@/components/ClassStudentPicker";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function studentName(s: Student | undefined) {
  return s ? `${s.first_name} ${s.last_name}` : "Unknown learner";
}

const EXEAT_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "secondary",
  denied: "destructive",
  out: "default",
  returned: "secondary",
  returned_late: "destructive",
};

function useBoardingData() {
  const { token, user } = useAuth();
  const [houses, setHouses] = useState<BoardingHouse[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignments, setAssignments] = useState<BoardingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listBoardingHouses(token, user.school_id),
      api.listStudents(token, user.school_id),
      api.listClasses(token, user.school_id),
      api.listBoardingAssignments(token, user.school_id),
    ])
      .then(([h, s, c, a]) => {
        setHouses(h);
        setStudents(s);
        setClasses(c);
        setAssignments(a);
      })
      .finally(() => setLoading(false));
  };

  useEffect(reload, [token, user?.school_id]);

  return { houses, students, classes, assignments, loading, reload };
}

function NewHouseDialog({ onCreated }: { onCreated: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", gender: "F", total_beds: "40" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      await api.createBoardingHouse(token, user.school_id, { name: form.name, gender: form.gender, total_beds: Number(form.total_beds) });
      toast.success(`${form.name} added`);
      setOpen(false);
      setForm({ name: "", gender: "F", total_beds: "40" });
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add house");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />New house</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>New boarding house</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v) => v && setForm((f) => ({ ...f, gender: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Girls</SelectItem>
                <SelectItem value="M">Boys</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Total beds</Label>
            <Input required type="number" min={1} value={form.total_beds} onChange={(e) => setForm((f) => ({ ...f, total_beds: e.target.value }))} />
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add house"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignBedDialog({
  houses,
  unassigned,
  classes,
  onAssigned,
}: {
  houses: BoardingHouse[];
  unassigned: Student[];
  classes: SchoolClass[];
  onAssigned: () => void;
}) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", house_id: "", bed_number: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.student_id || !form.house_id) return;
    setSubmitting(true);
    try {
      await api.assignBed(token, user.school_id, { student_id: Number(form.student_id), house_id: Number(form.house_id), bed_number: form.bed_number });
      toast.success("Bed assigned");
      setOpen(false);
      setForm({ student_id: "", house_id: "", bed_number: "" });
      onAssigned();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to assign bed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><DoorOpen />Assign bed</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Assign a boarder to a bed</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-3 sm:grid-cols-2">
            <ClassStudentPicker
              classes={classes}
              students={unassigned}
              value={form.student_id}
              onChange={(v) => setForm((f) => ({ ...f, student_id: v }))}
              classLabel="Class"
              studentLabel="Learner"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>House</Label>
            <Select value={form.house_id} onValueChange={(v) => v && setForm((f) => ({ ...f, house_id: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select house" /></SelectTrigger>
              <SelectContent>
                {houses.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Bed number</Label>
            <Input required value={form.bed_number} onChange={(e) => setForm((f) => ({ ...f, bed_number: e.target.value }))} placeholder="e.g. 12" />
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Assigning..." : "Assign"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HousesTab({ canEdit }: { canEdit: boolean }) {
  const { houses, students, classes, assignments, loading, reload } = useBoardingData();
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const unassigned = useMemo(() => {
    const taken = new Set(assignments.map((a) => a.student_id));
    return students.filter((s) => s.is_active && !taken.has(s.id));
  }, [students, assignments]);

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        {canEdit && <AssignBedDialog houses={houses} unassigned={unassigned} classes={classes} onAssigned={reload} />}
        {canEdit && <NewHouseDialog onCreated={reload} />}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {houses.map((h) => {
          const residents = assignments.filter((a) => a.house_id === h.id);
          const pct = h.total_beds ? (h.occupied_beds / h.total_beds) * 100 : 0;
          return (
            <Card key={h.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{h.name}</CardTitle>
                  <CardDescription>{h.gender === "F" ? "Girls" : "Boys"} · {h.total_beds} beds</CardDescription>
                </div>
                <Badge variant={h.occupied_beds >= h.total_beds ? "destructive" : "secondary"}>{h.occupied_beds}/{h.total_beds} occupied</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {residents.length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {residents.map((a) => (
                      <li key={a.id} className="flex items-center justify-between">
                        <span>{studentName(studentById.get(a.student_id))}</span>
                        <span className="font-mono text-xs text-muted-foreground">Bed {a.bed_number}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyNote>No boarders assigned yet.</EmptyNote>
                )}
              </CardContent>
            </Card>
          );
        })}
        {houses.length === 0 && <EmptyNote>No boarding houses yet. Add one to get started.</EmptyNote>}
      </div>
    </div>
  );
}

function RollCallTab() {
  const { token, user } = useAuth();
  const { houses, students, assignments, loading } = useBoardingData();
  const [selectedHouseId, setHouseId] = useState<string>("");
  const [session, setSession] = useState<RollSession>("night");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<number, "P" | "A" | "S">>({});
  const [saving, setSaving] = useState(false);
  const houseId = selectedHouseId || (houses[0] ? String(houses[0].id) : "");

  useEffect(() => {
    if (!token || !user?.school_id || !houseId) return;
    api.listRollCalls(token, user.school_id, Number(houseId), date).then((rows) => {
      const existing = rows.find((r) => r.session === session);
      setMarks(
        existing
          ? Object.fromEntries(Object.entries(existing.marks).map(([k, v]) => [Number(k), v]))
          : {}
      );
    });
  }, [token, user?.school_id, houseId, date, session]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const boarders = assignments.filter((a) => String(a.house_id) === houseId);

  async function save() {
    if (!token || !user?.school_id || !houseId) return;
    setSaving(true);
    try {
      await api.submitRollCall(token, user.school_id, {
        house_id: Number(houseId),
        date,
        session,
        marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v])),
      });
      toast.success("Roll call saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save roll call");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>House</Label>
          <Select value={houseId} onValueChange={(v) => v && setHouseId(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{houses.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Session</Label>
          <Select value={session} onValueChange={(v) => v && setSession(v as RollSession)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
        <Button onClick={save} disabled={saving || !houseId}>
          {saving && <Spinner size={16} className="text-current" />} {saving ? "Saving..." : "Save roll call"}
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {boarders.map((a) => {
            const s = studentById.get(a.student_id);
            const v = marks[a.student_id];
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{studentName(s)}</p>
                  <p className="text-xs text-muted-foreground">Bed {a.bed_number}</p>
                </div>
                <div className="flex gap-1">
                  {(["P", "A", "S"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setMarks((m) => ({ ...m, [a.student_id]: opt }))}
                      aria-pressed={v === opt}
                      title={opt === "P" ? "In dorm" : opt === "A" ? "Missing" : "Sick bay"}
                      className={`flex size-8 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                        v === opt
                          ? opt === "P" ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : opt === "A" ? "border-red-500 bg-red-500/10 text-red-600" : "border-amber-500 bg-amber-500/10 text-amber-600"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {boarders.length === 0 && <EmptyNote>No boarders in this house yet.</EmptyNote>}
        </CardContent>
      </Card>
    </div>
  );
}

function NewExeatDialog({ students, classes, onCreated }: { students: Student[]; classes: SchoolClass[]; onCreated: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ student_id: "", from_date: today, to_date: today, reason: "", pickup_name: "", pickup_relation: "", pickup_phone: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.student_id) return;
    setSubmitting(true);
    try {
      await api.createExeat(token, user.school_id, {
        student_id: Number(form.student_id),
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason,
        pickup_name: form.pickup_name,
        pickup_relation: form.pickup_relation || undefined,
        pickup_phone: form.pickup_phone || undefined,
      });
      toast.success("Leave-out requested");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to request leave-out");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />New leave-out</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Request a leave-out</DialogTitle></DialogHeader>
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
            <Label>From</Label>
            <Input required type="date" value={form.from_date} onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input required type="date" value={form.to_date} onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Reason</Label>
            <Input required value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Collected by</Label>
            <Input required value={form.pickup_name} onChange={(e) => setForm((f) => ({ ...f, pickup_name: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Relationship</Label>
            <Input value={form.pickup_relation} onChange={(e) => setForm((f) => ({ ...f, pickup_relation: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Phone</Label>
            <Input value={form.pickup_phone} onChange={(e) => setForm((f) => ({ ...f, pickup_phone: e.target.value }))} />
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Requesting..." : "Request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExeatsTab({ canApprove }: { canApprove: boolean }) {
  const { token, user } = useAuth();
  const { students, classes, loading: studentsLoading } = useBoardingData();
  const [exeats, setExeats] = useState<Exeat[]>([]);
  const [loading, setLoading] = useState(true);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const reload = () => {
    if (!token || !user?.school_id) return;
    api.listExeats(token, user.school_id).then(setExeats).finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function act(fn: (t: string, s: number, id: number) => Promise<Exeat>, exeatId: number, label: string) {
    if (!token || !user?.school_id) return;
    try {
      await fn(token, user.school_id, exeatId);
      toast.success(label);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  if (loading || studentsLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><NewExeatDialog students={students.filter((s) => s.is_active)} classes={classes} onCreated={reload} /></div>
      <div className="flex flex-col gap-2">
        {exeats.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div>
                <p className="text-sm font-medium">{studentName(studentById.get(e.student_id))}</p>
                <p className="text-xs text-muted-foreground">
                  {e.reason} · {e.from_date} → {e.to_date} · collected by {e.pickup_name}
                  {e.gate_pass ? ` · pass ${e.gate_pass}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={EXEAT_BADGE[e.status]} className="capitalize">{e.status.replace("_", " ")}</Badge>
                {canApprove && e.status === "pending" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => act(api.approveExeat, e.id, "Approved")}><Check />Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(api.denyExeat, e.id, "Denied")}><X />Deny</Button>
                  </>
                )}
                {e.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => act(api.checkOutExeat, e.id, "Checked out")}><DoorOpen />Check out</Button>
                )}
                {e.status === "out" && (
                  <Button size="sm" variant="outline" onClick={() => act(api.checkInExeat, e.id, "Checked in")}><LogIn />Check in</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {exeats.length === 0 && <EmptyNote>No leave-outs on record.</EmptyNote>}
      </div>
    </div>
  );
}

function SickBayTab() {
  const { token, user } = useAuth();
  const { students, classes, loading: studentsLoading } = useBoardingData();
  const [visits, setVisits] = useState<SickBayVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ student_id: "", complaint: "", temperature: "", action: "rest_in_sick_bay" as const });
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const reload = () => {
    if (!token || !user?.school_id) return;
    api.listSickBayVisits(token, user.school_id).then(setVisits).finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.student_id) return;
    setSubmitting(true);
    try {
      await api.createSickBayVisit(token, user.school_id, {
        student_id: Number(form.student_id),
        complaint: form.complaint,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        action: form.action,
      });
      toast.success("Visit logged");
      setOpen(false);
      setForm({ student_id: "", complaint: "", temperature: "", action: "rest_in_sick_bay" });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to log visit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || studentsLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Stethoscope />Sick bay visit</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Log a sick bay visit</DialogTitle></DialogHeader>
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
              <div className="col-span-2 grid gap-1.5">
                <Label>Complaint</Label>
                <Input required value={form.complaint} onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Temperature (°C)</Label>
                <Input value={form.temperature} onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))} placeholder="36.8" />
              </div>
              <div className="grid gap-1.5">
                <Label>Action</Label>
                <Select value={form.action} onValueChange={(v) => v && setForm((f) => ({ ...f, action: v as typeof form.action }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rest_in_sick_bay">Rest in sick bay</SelectItem>
                    <SelectItem value="refer_to_clinic">Refer to clinic</SelectItem>
                    <SelectItem value="first_aid">First aid, back to dorm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={submitting} type="submit" className="col-span-2">
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-col gap-2">
        {visits.map((v) => (
          <Card key={v.id}>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <div>
                <p className="text-sm font-medium">{studentName(studentById.get(v.student_id))}</p>
                <p className="text-xs text-muted-foreground">{v.complaint}{v.temperature ? ` · ${v.temperature}°C` : ""}</p>
              </div>
              <Badge variant="secondary">{v.status}</Badge>
            </CardContent>
          </Card>
        ))}
        {visits.length === 0 && <EmptyNote>No sick bay visits logged.</EmptyNote>}
      </div>
    </div>
  );
}

function IncidentsTab() {
  const { token, user } = useAuth();
  const { houses, loading: housesLoading } = useBoardingData();
  const [incidents, setIncidents] = useState<BoardingIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ house_id: "", type: "Bullying", description: "", action_taken: "" });
  const houseById = useMemo(() => new Map(houses.map((h) => [h.id, h])), [houses]);

  const reload = () => {
    if (!token || !user?.school_id) return;
    api.listBoardingIncidents(token, user.school_id).then(setIncidents).finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.house_id) return;
    setSubmitting(true);
    try {
      await api.createBoardingIncident(token, user.school_id, { house_id: Number(form.house_id), type: form.type, description: form.description, action_taken: form.action_taken });
      toast.success("Incident recorded");
      setOpen(false);
      setForm({ house_id: "", type: "Bullying", description: "", action_taken: "" });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record incident");
    } finally {
      setSubmitting(false);
    }
  }

  async function close(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.closeBoardingIncident(token, user.school_id, id);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to close incident");
    }
  }

  if (loading || housesLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><ShieldAlert />Record incident</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Record a boarding incident</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>House</Label>
                <Select value={form.house_id} onValueChange={(v) => v && setForm((f) => ({ ...f, house_id: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select house" /></SelectTrigger>
                  <SelectContent>{houses.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Bullying", "Fight", "Fire or safety", "Property damage", "Late return", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label>What happened</Label>
                <Textarea required rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label>Action taken</Label>
                <Input required value={form.action_taken} onChange={(e) => setForm((f) => ({ ...f, action_taken: e.target.value }))} />
              </div>
              <Button disabled={submitting} type="submit" className="col-span-2">
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Record"}
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
                <p className="text-sm font-medium">{i.type} · {houseById.get(i.house_id)?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{i.description}</p>
                <p className="text-xs text-muted-foreground">Action: {i.action_taken}</p>
              </div>
              <div className="flex items-center gap-2">
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

export default function BoardingPage() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return null;
  const canEdit = user.role === "head_of_institution" || user.role === "group_principal";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Boarding" description="Houses, beds, roll calls, leave-outs, sick bay and incidents." />
      <Tabs defaultValue="houses">
        <TabsList>
          <TabsTrigger value="houses">Houses &amp; beds</TabsTrigger>
          <TabsTrigger value="roll">Roll call</TabsTrigger>
          <TabsTrigger value="exeats">Leave-outs</TabsTrigger>
          <TabsTrigger value="sick">Sick bay</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
        </TabsList>
        <TabsContent value="houses"><HousesTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="roll"><RollCallTab /></TabsContent>
        <TabsContent value="exeats"><ExeatsTab canApprove={canEdit} /></TabsContent>
        <TabsContent value="sick"><SickBayTab /></TabsContent>
        <TabsContent value="incidents"><IncidentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
