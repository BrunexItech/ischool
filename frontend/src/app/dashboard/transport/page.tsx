"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Bus, MapPin, UserCog } from "lucide-react";
import { api, ApiError, Student, TransportRoute, Vehicle } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_VEHICLE = "none";
const UNASSIGN = "unassign";

function AddStopForm({ routeId, onAdded }: { routeId: number; onAdded: (route: TransportRoute) => void }) {
  const { token, user } = useAuth();
  const [name, setName] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const updated = await api.addRouteStop(token, user.school_id, routeId, {
        name,
        stop_order: 999,
        pickup_time: pickupTime || undefined,
      });
      onAdded(updated);
      setName("");
      setPickupTime("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add stop");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <Input required placeholder="Stop name" value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
      <Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-32" />
      <Button size="sm" type="submit" disabled={submitting}>{submitting ? "Adding..." : "Add stop"}</Button>
    </form>
  );
}

export default function TransportPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [vehicleForm, setVehicleForm] = useState({ registration_number: "", capacity: "", driver_name: "", driver_phone: "" });
  const [routeForm, setRouteForm] = useState({ name: "", vehicle_id: NO_VEHICLE });
  const [assignForm, setAssignForm] = useState({ student_id: "", route_id: "", stop_id: UNASSIGN });
  const [submittingVehicle, setSubmittingVehicle] = useState(false);
  const [submittingRoute, setSubmittingRoute] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  useEffect(() => {
    if (!loading && user && !["school_admin", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listVehicles(token, user.school_id).then(setVehicles),
      api.listTransportRoutes(token, user.school_id).then(setRoutes),
      api.listStudents(token, user.school_id).then(setStudents),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  function vehicleLabel(id: number | null) {
    if (!id) return "No vehicle assigned";
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.registration_number} · ${v.driver_name}` : `#${id}`;
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmittingVehicle(true);
    try {
      const created = await api.createVehicle(token, user.school_id, {
        registration_number: vehicleForm.registration_number,
        capacity: Number(vehicleForm.capacity),
        driver_name: vehicleForm.driver_name,
        driver_phone: vehicleForm.driver_phone,
      });
      setVehicles((v) => [...v, created]);
      setVehicleForm({ registration_number: "", capacity: "", driver_name: "", driver_phone: "" });
      toast.success(`${created.registration_number} added`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add vehicle");
    } finally {
      setSubmittingVehicle(false);
    }
  }

  async function handleAddRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmittingRoute(true);
    try {
      const created = await api.createTransportRoute(token, user.school_id, {
        name: routeForm.name,
        vehicle_id: routeForm.vehicle_id === NO_VEHICLE ? undefined : Number(routeForm.vehicle_id),
      });
      setRoutes((r) => [...r, created]);
      setRouteForm({ name: "", vehicle_id: NO_VEHICLE });
      toast.success(`${created.name} added`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add route");
    } finally {
      setSubmittingRoute(false);
    }
  }

  function handleStopAdded(updated: TransportRoute) {
    setRoutes((all) => all.map((r) => (r.id === updated.id ? updated : r)));
  }

  const stopsForSelectedRoute = routes.find((r) => String(r.id) === assignForm.route_id)?.stops ?? [];

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !assignForm.student_id || !assignForm.route_id) return;
    setSubmittingAssign(true);
    try {
      await api.assignStudentTransport(token, user.school_id, Number(assignForm.student_id), {
        transport_route_id: Number(assignForm.route_id),
        transport_stop_id: assignForm.stop_id === UNASSIGN ? null : Number(assignForm.stop_id),
      });
      toast.success("Student assigned to route");
      setAssignForm({ student_id: "", route_id: "", stop_id: UNASSIGN });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to assign student");
    } finally {
      setSubmittingAssign(false);
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Transport" description="Vehicles, routes, and stops for school transport." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Transport" description="Vehicles, routes, and stops for school transport." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bus className="size-4.5" /> Vehicles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleAddVehicle} className="flex flex-wrap items-end gap-3">
            <Input required placeholder="Registration (KDA 123X)" value={vehicleForm.registration_number} onChange={(e) => setVehicleForm((f) => ({ ...f, registration_number: e.target.value }))} className="w-44" />
            <Input required type="number" min={1} placeholder="Capacity" value={vehicleForm.capacity} onChange={(e) => setVehicleForm((f) => ({ ...f, capacity: e.target.value }))} className="w-28" />
            <Input required placeholder="Driver name" value={vehicleForm.driver_name} onChange={(e) => setVehicleForm((f) => ({ ...f, driver_name: e.target.value }))} className="w-40" />
            <Input required placeholder="Driver phone" value={vehicleForm.driver_phone} onChange={(e) => setVehicleForm((f) => ({ ...f, driver_phone: e.target.value }))} className="w-40" />
            <Button type="submit" disabled={submittingVehicle}><Plus /> {submittingVehicle ? "Adding..." : "Add vehicle"}</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {vehicles.map((v) => (
              <Badge key={v.id} variant="secondary">{v.registration_number} · {v.capacity} seats · {v.driver_name} ({v.driver_phone})</Badge>
            ))}
            {vehicles.length === 0 && <p className="text-sm text-muted-foreground">No vehicles yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="size-4.5" /> Routes & Stops</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleAddRoute} className="flex flex-wrap items-end gap-3">
            <Input required placeholder="Route name" value={routeForm.name} onChange={(e) => setRouteForm((f) => ({ ...f, name: e.target.value }))} className="w-48" />
            <Select value={routeForm.vehicle_id} onValueChange={(v) => v && setRouteForm((f) => ({ ...f, vehicle_id: v }))}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VEHICLE}>No vehicle yet</SelectItem>
                {vehicles.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.registration_number}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={submittingRoute}><Plus /> {submittingRoute ? "Adding..." : "Add route"}</Button>
          </form>

          <div className="flex flex-col gap-3">
            {routes.map((route) => (
              <div key={route.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{route.name}</p>
                  <span className="text-xs text-muted-foreground">{vehicleLabel(route.vehicle_id)}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {route.stops.map((s) => (
                    <Badge key={s.id} variant="outline">{s.stop_order}. {s.name}{s.pickup_time ? ` (${s.pickup_time})` : ""}</Badge>
                  ))}
                  {route.stops.length === 0 && <span className="text-xs text-muted-foreground">No stops yet.</span>}
                </div>
                <AddStopForm routeId={route.id} onAdded={handleStopAdded} />
              </div>
            ))}
            {routes.length === 0 && <p className="text-sm text-muted-foreground">No routes yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><UserCog className="size-4.5" /> Assign a student</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-3">
            <Select value={assignForm.student_id} onValueChange={(v) => v && setAssignForm((f) => ({ ...f, student_id: v }))}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Student" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name} ({s.admission_number})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assignForm.route_id} onValueChange={(v) => v && setAssignForm((f) => ({ ...f, route_id: v, stop_id: UNASSIGN }))}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Route" /></SelectTrigger>
              <SelectContent>
                {routes.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assignForm.stop_id} onValueChange={(v) => v && setAssignForm((f) => ({ ...f, stop_id: v }))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Stop" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGN}>No specific stop</SelectItem>
                {stopsForSelectedRoute.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={submittingAssign || !assignForm.student_id || !assignForm.route_id}>
              {submittingAssign ? "Assigning..." : "Assign"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
