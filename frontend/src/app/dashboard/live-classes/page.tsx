"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { ModuleBanner } from "@/components/ModuleBanner";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Copy, Plus, RotateCw, Users, Video } from "lucide-react";
import { api, ApiError, LiveClass, MyClass, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DepartmentPulse } from "@/components/DepartmentPulse";
import { ViewOnly } from "@/components/oversight";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Loaded {
  liveClasses: LiveClass[];
  classes: SchoolClass[];
  myClasses: MyClass[];
}

async function fetchAll(token: string, schoolId: number, isTeacher: boolean): Promise<{ data: Loaded; failed: boolean }> {
  let failed = false;
  const [liveClasses, classes, myClasses] = await Promise.all([
    api.listLiveClasses(token, schoolId).catch(() => {
      failed = true;
      return [] as LiveClass[];
    }),
    api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
    isTeacher ? api.listMyClasses(token, schoolId).catch(() => [] as MyClass[]) : Promise.resolve([] as MyClass[]),
  ]);
  return { data: { liveClasses, classes, myClasses }, failed };
}

function ScheduleDialog({ data, isTeacher, onClose, onCreated }: { data: Loaded; isTeacher: boolean; onClose: () => void; onCreated: (c: LiveClass) => void }) {
  const { token, user } = useAuth();
  const mine = new Set(data.myClasses.map((c) => c.class_id));
  const options = isTeacher ? data.classes.filter((c) => mine.has(c.id)) : data.classes;
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(isTeacher ? "" : "none");
  const [start, setStart] = useState(() => toLocalInputValue(new Date()));
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      const created = await api.scheduleLiveClass(token, user.school_id, {
        title: title.trim(),
        scheduled_start: new Date(start).toISOString(),
        class_id: classId && classId !== "none" ? Number(classId) : undefined,
      });
      onCreated(created);
      toast.success("Live class scheduled");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to schedule live class");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Schedule a live class</DialogTitle></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid gap-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mathematics: fractions revision" autoFocus /></div>
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
              <SelectContent>
                {!isTeacher && <SelectItem value="none">Whole school</SelectItem>}
                {options.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Starts</Label><Input type="datetime-local" required value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim() || (isTeacher && !classId)}>{saving && <Spinner size={16} className="text-current" />} Schedule</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JoinsDialog({ live, onClose }: { live: LiveClass; onClose: () => void }) {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<{ name: string; kind: string; joined_at: string }[] | null>(null);
  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    api.listLiveJoins(token, user.school_id, live.id).then((r) => !cancelled && setRows(r)).catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, live.id]);
  const KIND: Record<string, string> = { host: "Teacher", student: "Learner", guest: "Joined by link" };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Who joined: {live.title}</DialogTitle></DialogHeader>
        {!rows ? <PageLoader /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nobody has joined yet.</p> : (
          <ul className="divide-y rounded-lg border">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0"><span className="block font-medium break-words">{r.name}</span><span className="block text-xs text-muted-foreground">{KIND[r.kind] ?? r.kind}</span></span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{new Date(r.joined_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function LiveClassesPage() {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isTeacher = user?.role === "teacher";
  const canSchedule = isTeacher || user?.role === "super_admin";
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [joinsFor, setJoinsFor] = useState<LiveClass | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    fetchAll(token, schoolId, isTeacher).then(({ data: d, failed: f }) => {
      if (cancelled) return;
      setData(d);
      setFailed(f);
    });
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, isTeacher, reloadKey]);

  if (!data) return failed ? null : <PageLoader />;

  const className = (id: number | null) => (id ? (data.classes.find((c) => c.id === id)?.name ?? "Class") : "Whole school");
  const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  const sorted = [...data.liveClasses].sort((a, b) => +new Date(a.scheduled_start) - +new Date(b.scheduled_start));
  const upcoming = sorted.filter((l) => new Date(l.scheduled_start).getTime() >= startOfToday);
  const past = sorted.filter((l) => new Date(l.scheduled_start).getTime() < startOfToday).reverse();

  async function copyLink(lc: LiveClass) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${lc.join_code}`);
      toast.success("Join link copied");
    } catch {
      toast.error("Couldn't copy. Copy the link manually.");
    }
  }

  const Row = ({ lc }: { lc: LiveClass }) => {
    const d = new Date(lc.scheduled_start);
    const today = d.toDateString() === new Date(now).toDateString();
    return (
      <li className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Video className="size-5" /></span>
          <div className="min-w-0">
            <p className="font-medium break-words">{lc.title}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{className(lc.class_id)}</span>
              {today && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Today</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-10 sm:h-8" onClick={() => copyLink(lc)}><Copy /> Join link</Button>
          <Button variant="outline" size="sm" className="h-10 sm:h-8" onClick={() => setJoinsFor(lc)}><Users /> Who joined</Button>
          <Button size="sm" className="h-10 sm:h-8" nativeButton={false} render={<Link href={`/live-classes/${lc.id}/room`}>Start as host</Link>} />
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <ModuleBanner title="Live Classes" description="Schedule and host video lessons. You control who is let in and who can speak.">{canSchedule && <Button className="h-10 w-fit sm:h-9" onClick={() => setNewOpen(true)}><Plus /> Schedule class</Button>}</ModuleBanner>

      <DepartmentPulse dept="live_classes" />

      {!canSchedule && <ViewOnly>Teachers schedule and host live classes. You can see every session, who joined, and step in to watch.</ViewOnly>}

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the live classes.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
        </div>
      ) : data.liveClasses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <Video className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No live classes yet</p>
          {canSchedule && <Button size="sm" className="mt-2" onClick={() => setNewOpen(true)}><Plus /> Schedule class</Button>}
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 font-heading text-lg font-semibold sm:px-5">Today and upcoming</h2>
            {upcoming.length === 0 ? <EmptyNote>Nothing scheduled. Schedule a class to get a join link.</EmptyNote> : <ul className="divide-y">{upcoming.map((l) => <Row key={l.id} lc={l} />)}</ul>}
          </section>
          {past.length > 0 && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <button type="button" aria-expanded={showPast} onClick={() => setShowPast((s) => !s)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5">
                <span><span className="block font-heading text-lg font-semibold">Earlier classes</span><span className="block text-sm text-muted-foreground">{past.length} past class{past.length === 1 ? "" : "es"}</span></span>
                <ChevronDown className={`size-5 text-muted-foreground transition-transform ${showPast ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {showPast && <ul className="divide-y border-t">{past.map((l) => <Row key={l.id} lc={l} />)}</ul>}
            </section>
          )}
        </>
      )}

      {newOpen && canSchedule && <ScheduleDialog data={data} isTeacher={isTeacher} onClose={() => setNewOpen(false)} onCreated={(c) => setData((d) => (d ? { ...d, liveClasses: [c, ...d.liveClasses] } : d))} />}
      {joinsFor && <JoinsDialog live={joinsFor} onClose={() => setJoinsFor(null)} />}
    </div>
  );
}
