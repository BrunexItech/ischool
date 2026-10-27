"use client";

import { useModuleTab } from "@/lib/moduleTabs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, RunSummary, SchoolClass, Student, TransportOverview, TransportRoute, Vehicle } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHead, ViewOnly } from "@/components/oversight";
import { AttendantRuns, ClassMovement, FleetPanel, RoutesPanel, RunsBoard } from "@/components/TransportViews";
import { PageLoader } from "@/components/Spinner";

const OVERSEERS = ["head_of_institution", "group_principal"];
const MANAGERS = ["transport_staff", "staff", "super_admin"];
const ALLOWED = [...OVERSEERS, ...MANAGERS, "transport_attendant"];

type Tab = "movement" | "runs" | "fleet" | "routes";

export default function TransportPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isAttendant = user?.role === "transport_attendant";
  const isOverseer = !!user && OVERSEERS.includes(user.role);
  const canManage = !!user && MANAGERS.includes(user.role);
  const tabParam = useModuleTab("transport") as Tab;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [alerts, setAlerts] = useState<TransportOverview["fleet_alerts"]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && user && !ALLOWED.includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId || isAttendant) return;
    let cancelled = false;
    Promise.all([
      api.listVehicles(token, schoolId).catch(() => [] as Vehicle[]),
      api.listTransportRoutes(token, schoolId).catch(() => [] as TransportRoute[]),
      api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
      canManage ? api.listStudents(token, schoolId).catch(() => [] as Student[]) : Promise.resolve([] as Student[]),
      api.listRuns(token, schoolId).catch(() => [] as RunSummary[]),
      isOverseer ? api.getTransportOverview(token, schoolId, { class_id: -1 }).then((o) => o.fleet_alerts).catch(() => []) : Promise.resolve([]),
    ]).then(([vs, rs, cs, ss, rn, al]) => {
      if (cancelled) return;
      setVehicles(vs);
      setRoutes(rs);
      setClasses(cs);
      setStudents(ss);
      setRuns(rn);
      setAlerts(al);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isAttendant, isOverseer, canManage]);

  if (loading || !user || !schoolId) return <PageLoader />;

  if (isAttendant) {
    return (
      <div className="flex flex-col gap-5">
        <PageHead title="My runs" subtitle="Check each child on and off the vehicle. Parents are told as you go." />
        <AttendantRuns schoolId={schoolId} />
      </div>
    );
  }
  if (!ready) return <PageLoader />;

  const tabs: [Tab, string][] = [
    ...(isOverseer ? ([["movement", "Arrivals and departures"]] as [Tab, string][]) : []),
    ["runs", "Today's runs"],
    ["fleet", "Fleet"],
    ["routes", "Routes and learners"],
  ];
  const view = tabParam || tabs[0][0];

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Transport" subtitle={isOverseer ? "How children arrive and leave, the bus runs, and the state of the fleet." : "Vehicles, routes, learners and the daily runs."} />
      {isOverseer && <ViewOnly label="Oversight">The transport office and the attendants keep these records. Pick any date to see how each class was picked up and dropped.</ViewOnly>}
      {view === "movement" && <ClassMovement schoolId={schoolId} classes={classes} />}
      {view === "runs" && <RunsBoard runs={runs} schoolId={schoolId} />}
      {view === "fleet" && <FleetPanel schoolId={schoolId} vehicles={vehicles} setVehicles={setVehicles} alerts={alerts} canManage={canManage} />}
      {view === "routes" && <RoutesPanel schoolId={schoolId} routes={routes} setRoutes={setRoutes} vehicles={vehicles} students={students} classes={classes} canManage={canManage} />}
    </div>
  );
}
