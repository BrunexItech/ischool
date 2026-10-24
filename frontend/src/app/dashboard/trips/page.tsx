"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bus, Plus } from "lucide-react";
import { api, ApiError, SchoolClass, Student, Trip, TripStatus, Vehicle } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const TRIP_TYPES = ["Field trip", "Sports fixture", "Excursion", "Competition", "Academic trip", "Other"];

const STATUS_BADGE: Record<TripStatus, "default" | "secondary" | "destructive" | "outline"> = {
  requested: "outline",
  approved: "secondary",
  in_progress: "default",
  completed: "secondary",
  declined: "destructive",
  cancelled: "destructive",
};

function kes(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function NewTripDialog({ classes, students, onCreated }: { classes: SchoolClass[]; students: Student[]; onCreated: (t: Trip) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<Set<number>>(new Set());
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({
    title: "",
    trip_type: "",
    purpose: "",
    destination: "",
    start_date: "",
    end_date: "",
    departure_time: "07:00",
    return_time: "17:00",
    staff_count: "2",
    distance_km: "",
  });

  const eligibleStudents = useMemo(
    () => students.filter((s) => s.is_active && s.class_id && selectedClasses.has(s.class_id)),
    [students, selectedClasses]
  );
  const chosenStudentIds = eligibleStudents.filter((s) => !excluded.has(s.id)).map((s) => s.id);

  function toggleClass(id: number) {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.trip_type || chosenStudentIds.length === 0) {
      if (chosenStudentIds.length === 0) toast.error("Tick at least one class with learners travelling");
      return;
    }
    setSubmitting(true);
    try {
      const trip = await api.requestTrip(token, user.school_id, {
        title: form.title,
        trip_type: form.trip_type,
        purpose: form.purpose,
        destination: form.destination,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        departure_time: form.departure_time,
        return_time: form.return_time,
        class_ids: [...selectedClasses],
        student_ids: chosenStudentIds,
        staff_count: Number(form.staff_count),
        distance_km: Number(form.distance_km),
      });
      toast.success(`${trip.reference} sent for approval`);
      setOpen(false);
      onCreated(trip);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to request trip");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Bus />Request school bus</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Request school bus</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">The transport office checks bus and driver availability, then approves or replies.</p>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>Trip name</Label>
            <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Lake Bogoria field study" />
          </div>
          <div className="grid gap-1.5">
            <Label>Type of trip</Label>
            <Select value={form.trip_type} onValueChange={(v) => v && setForm((f) => ({ ...f, trip_type: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{TRIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Destination / venue</Label>
            <Input required value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Purpose and learning outcome</Label>
            <Textarea required rows={2} value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Starts</Label>
            <Input required type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Ends</Label>
            <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Leaves school</Label>
            <Input required type="time" value={form.departure_time} onChange={(e) => setForm((f) => ({ ...f, departure_time: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Back at school</Label>
            <Input required type="time" value={form.return_time} onChange={(e) => setForm((f) => ({ ...f, return_time: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Teachers and chaperones</Label>
            <Input required type="number" min={1} value={form.staff_count} onChange={(e) => setForm((f) => ({ ...f, staff_count: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>One-way distance (km)</Label>
            <Input required type="number" min={1} max={1500} value={form.distance_km} onChange={(e) => setForm((f) => ({ ...f, distance_km: e.target.value }))} />
          </div>

          <div className="col-span-2 grid gap-1.5">
            <Label>Classes travelling</Label>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleClass(c.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${selectedClasses.has(c.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {selectedClasses.size > 0 && (
            <div className="col-span-2 grid gap-1.5">
              <Label>Learners · {chosenStudentIds.length} selected</Label>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
                {eligibleStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!excluded.has(s.id)}
                      onChange={() => setExcluded((prev) => {
                        const n = new Set(prev);
                        if (n.has(s.id)) n.delete(s.id);
                        else n.add(s.id);
                        return n;
                      })}
                    />
                    {s.first_name} {s.last_name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Sending..." : "Send request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TripDetailDialog({
  trip,
  vehicles,
  canManage,
  open,
  onOpenChange,
  onUpdated,
}: {
  trip: Trip;
  vehicles: Vehicle[];
  canManage: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (t: Trip) => void;
}) {
  const { token, user } = useAuth();
  const [vehicleId, setVehicleId] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<Trip>, label: string) {
    setBusy(true);
    try {
      const updated = await fn();
      onUpdated(updated);
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !user?.school_id) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{trip.title}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-mono text-xs text-muted-foreground">{trip.reference}</p>
          <p>{trip.destination} · {trip.trip_type}</p>
          <p className="text-muted-foreground">{trip.purpose}</p>
          <p>{trip.start_date} → {trip.end_date} · {trip.departure_time.slice(0, 5)}–{trip.return_time.slice(0, 5)}</p>
          <p>{trip.student_ids.length} learners + {trip.staff_count} staff · {trip.distance_km} km one-way</p>
          <p className="font-medium">Estimated cost: {kes(trip.estimated_cost)}</p>
          <Badge variant={STATUS_BADGE[trip.status]} className="w-fit capitalize">{trip.status.replace("_", " ")}</Badge>
        </div>

        {canManage && trip.status === "requested" && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <Label>Assign a bus (optional)</Label>
            <Select value={vehicleId} onValueChange={(v) => v && setVehicleId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Let the transport office choose" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.registration_number} · {v.capacity} seats</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => act(() => api.approveTrip(token, user.school_id!, trip.id, vehicleId ? Number(vehicleId) : undefined), "Approved")}>
                {busy && <Spinner size={16} className="text-current" />} Approve
              </Button>
              <Button disabled={busy} variant="ghost" onClick={() => act(() => api.declineTrip(token, user.school_id!, trip.id), "Declined")}>Decline</Button>
            </div>
          </div>
        )}
        {canManage && trip.status === "approved" && (
          <div className="flex gap-2 border-t pt-3">
            <Button disabled={busy} onClick={() => act(() => api.startTrip(token, user.school_id!, trip.id), "Trip started")}>Start trip</Button>
            <Button disabled={busy} variant="ghost" onClick={() => act(() => api.cancelTrip(token, user.school_id!, trip.id), "Cancelled")}>Cancel</Button>
          </div>
        )}
        {canManage && trip.status === "in_progress" && (
          <div className="border-t pt-3">
            <Button disabled={busy} onClick={() => act(() => api.completeTrip(token, user.school_id!, trip.id), "Trip completed")}>Mark completed</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TripsPage() {
  const { user, token, loading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TripStatus | "">("");
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listTrips(token, user.school_id),
      api.listClasses(token, user.school_id),
      api.listStudents(token, user.school_id),
      api.listVehicles(token, user.school_id),
    ])
      .then(([t, c, s, v]) => {
        setTrips(t);
        setClasses(c);
        setStudents(s);
        setVehicles(v);
      })
      .finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  if (loading || dataLoading) return <PageLoader />;
  if (!user) return null;

  const canRequest = user.role === "head_of_institution" || user.role === "teacher" || user.role === "group_principal";
  const canManage = user.role === "head_of_institution" || user.role === "group_principal";
  const filtered = statusFilter ? trips.filter((t) => t.status === statusFilter) : trips;
  const statuses: (TripStatus | "")[] = ["", "requested", "approved", "in_progress", "completed", "declined", "cancelled"];

  function upsert(trip: Trip) {
    setTrips((ts) => {
      const exists = ts.some((t) => t.id === trip.id);
      return exists ? ts.map((t) => (t.id === trip.id ? trip : t)) : [trip, ...ts];
    });
    setActiveTrip((at) => (at && at.id === trip.id ? trip : at));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trips"
        description="School trips and bus bookings."
        action={canRequest ? <NewTripDialog classes={classes} students={students} onCreated={upsert} /> : undefined}
      />

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {s ? s.replace("_", " ") : "All"} <span className="text-muted-foreground">{s ? trips.filter((t) => t.status === s).length : trips.length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((t) => (
          <Card key={t.id} className="cursor-pointer hover:border-primary/40" onClick={() => setActiveTrip(t)}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div>
                <p className="text-sm font-medium">{t.title} <span className="font-mono text-xs text-muted-foreground">{t.reference}</span></p>
                <p className="text-xs text-muted-foreground">
                  {t.destination} · {t.start_date} → {t.end_date} · {t.student_ids.length + t.staff_count} travelling
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_BADGE[t.status]} className="capitalize">{t.status.replace("_", " ")}</Badge>
                <Button size="sm" variant={canManage && t.status === "requested" ? "default" : "outline"} onClick={(e) => { e.stopPropagation(); setActiveTrip(t); }}>
                  {canManage && t.status === "requested" ? "Review" : "Open"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><Plus className="size-3.5" />No trips match.</p>
        )}
      </div>

      {activeTrip && (
        <TripDetailDialog
          key={activeTrip.id}
          trip={activeTrip}
          vehicles={vehicles}
          canManage={canManage}
          open
          onOpenChange={(v) => !v && setActiveTrip(null)}
          onUpdated={upsert}
        />
      )}
    </div>
  );
}
