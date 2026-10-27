"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CircleDot, Plus, Users, Video } from "lucide-react";
import { api, ApiError, MeetingAttendance, MeetingCandidateSchool, StaffMeeting } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ErrorBox, PageHead, Pill } from "@/components/oversight";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function ScheduleDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { token, user } = useAuth();
  const [schools, setSchools] = useState<MeetingCandidateSchool[] | null>(null);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [start, setStart] = useState(() => localInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const principal = user?.role === "group_principal";

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.meetingCandidates(token).then((c) => {
      if (cancelled) return;
      setSchools(c);
      if (c.length === 1) setChosen(new Set([c[0].school_id]));
    }).catch(() => !cancelled && setSchools([]));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const inScope = useMemo(() => (schools ?? []).filter((s) => chosen.has(s.school_id)), [schools, chosen]);
  const total = inScope.reduce((n, s) => n + s.teachers.length, 0);
  const toggle = (set: Set<number>, id: number) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const valid = title.trim().length >= 3 && chosen.size > 0 && total > 0 && (audience === "all" || [...picked].some((id) => inScope.some((s) => s.teachers.some((t) => t.user_id === id))));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      const ids = [...picked].filter((id) => inScope.some((s) => s.teachers.some((t) => t.user_id === id)));
      await api.scheduleMeeting(token, { title: title.trim(), agenda: agenda.trim() || undefined, scheduled_start: new Date(start).toISOString(), school_ids: [...chosen], audience, teacher_ids: audience === "selected" ? ids : [] });
      toast.success("Meeting scheduled. The teachers have been told.");
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't schedule the meeting.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Call a staff meeting</DialogTitle></DialogHeader>
        {!schools ? <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p> : (
          <form onSubmit={save} className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_13rem]">
              <div className="flex flex-col gap-1.5"><Label htmlFor="m-title">What is it about?</Label><Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Term 3 examinations plan" className="h-10" autoFocus /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="m-when">When</Label><Input id="m-when" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="h-10" /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="m-agenda">Agenda (optional)</Label><Textarea id="m-agenda" rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></div>

            {(schools.length > 1 || principal) && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 flex w-full items-center justify-between text-sm font-medium">Which schools?<button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setChosen(chosen.size === schools.length ? new Set() : new Set(schools.map((s) => s.school_id)))}>{chosen.size === schools.length ? "Clear" : "All my schools"}</button></legend>
                <div className="flex flex-wrap gap-1.5">{schools.map((s) => <button key={s.school_id} type="button" aria-pressed={chosen.has(s.school_id)} onClick={() => setChosen((c) => toggle(c, s.school_id))} className={`h-9 rounded-full border px-3.5 text-sm font-medium ${chosen.has(s.school_id) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{s.school_name} <span className="opacity-75">{s.teachers.length}</span></button>)}</div>
              </fieldset>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Who is invited?</legend>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {([["all", `All teachers${chosen.size ? ` (${total})` : ""}`, "Every teacher in the chosen schools"], ["selected", "Chosen teachers", "Pick exactly who to call"]] as const).map(([k, label, sub]) => (
                  <button key={k} type="button" role="radio" aria-checked={audience === k} onClick={() => setAudience(k)} className={`rounded-xl border p-3 text-left transition-colors ${audience === k ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"}`}><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{sub}</span></button>
                ))}
              </div>
              {audience === "selected" && (
                <div className="flex flex-col gap-2 rounded-xl border p-3">
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teachers..." aria-label="Search teachers" className="h-9" />
                  <div className="flex max-h-56 flex-col gap-3 overflow-y-auto">
                    {inScope.length === 0 && <p className="text-sm text-muted-foreground">Choose a school first.</p>}
                    {inScope.map((s) => {
                      const list = s.teachers.filter((t) => !query || t.full_name.toLowerCase().includes(query.toLowerCase()));
                      if (list.length === 0) return null;
                      const all = list.every((t) => picked.has(t.user_id));
                      return (
                        <div key={s.school_id}>
                          <div className="mb-1 flex items-center justify-between"><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.school_name}</p><button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setPicked((p) => { const n = new Set(p); for (const t of list) { if (all) n.delete(t.user_id); else n.add(t.user_id); } return n; })}>{all ? "Clear" : "Select all"}</button></div>
                          <ul className="grid gap-1 sm:grid-cols-2">{list.map((t) => <li key={t.user_id}><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"><input type="checkbox" checked={picked.has(t.user_id)} onChange={() => setPicked((p) => toggle(p, t.user_id))} className="size-4 accent-[var(--primary)]" />{t.full_name}</label></li>)}</ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </fieldset>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="h-11 sm:h-10" onClick={onClose}>Cancel</Button><Button type="submit" className="h-11 sm:h-10" disabled={!valid || busy}>{busy && <Spinner size={16} className="text-current" />} Schedule and notify</Button></div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Attendance({ id, onClose }: { id: number; onClose: () => void }) {
  const { token } = useAuth();
  const [data, setData] = useState<MeetingAttendance | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.meetingAttendance(token, id).then((d) => !cancelled && setData(d)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{data?.meeting.title ?? "Who attended"}</DialogTitle></DialogHeader>
        {!data ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : (
          <>
            <p className="text-sm text-muted-foreground">{data.attendees.filter((a) => a.joined_at).length} of {data.attendees.length} invited teachers joined.</p>
            <ul className="divide-y rounded-lg border">
              {data.attendees.map((a) => <li key={a.user_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span className="min-w-0"><span className="block font-medium break-words">{a.name}</span><span className="block text-xs text-muted-foreground">{a.school_name}</span></span>{a.joined_at ? <Pill tone="good">Joined {new Date(a.joined_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</Pill> : <Pill tone="muted">Did not join</Pill>}</li>)}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [meetings, setMeetings] = useState<StaffMeeting[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [scheduling, setScheduling] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const canHost = user?.role === "head_of_institution" || user?.role === "group_principal";
  const hostable = canHost && !(user?.role === "group_principal" && user.school_id !== null); // a principal calls meetings from "All Schools"

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "group_principal", "teacher"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.listMeetings(token).then((m) => { if (!cancelled) { setMeetings(m); setFailed(false); } }).catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token, version]);

  async function end(m: StaffMeeting) {
    if (!token) return;
    setBusy(m.id);
    try {
      await api.endMeeting(token, m.id);
      toast.success(m.status === "live" ? "Meeting ended" : "Meeting cancelled");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't do that.");
    } finally {
      setBusy(null);
    }
  }

  if (loading || !user) return <PageLoader />;
  const live = (meetings ?? []).filter((m) => m.status === "live");
  const upcoming = (meetings ?? []).filter((m) => m.status === "scheduled");
  const past = (meetings ?? []).filter((m) => m.status === "ended" || m.status === "cancelled");

  const Card = ({ m }: { m: StaffMeeting }) => (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading text-lg leading-tight font-semibold break-words">{m.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" aria-hidden />{when(m.scheduled_start)}</span><span>Called by {m.is_host ? "you" : m.host_name}</span></p>
        </div>
        {m.status === "live" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-300"><CircleDot className="size-3 animate-pulse" aria-hidden /> Live now</span> : m.status === "cancelled" ? <Pill tone="muted">Cancelled</Pill> : m.status === "ended" ? <Pill tone="muted">Ended</Pill> : <Pill tone="info">Scheduled</Pill>}
      </div>
      {m.agenda && <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm whitespace-pre-line">{m.agenda}</p>}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{m.audience === "all" ? `All teachers (${m.invited})` : `${m.invited} chosen teacher${m.invited === 1 ? "" : "s"}`}</span><span>{m.school_names.join(", ")}</span>{m.joined > 0 && <span>{m.joined} joined</span>}</p>
      <div className="flex flex-wrap gap-2">
        {(m.status === "live" || (m.status === "scheduled" && m.is_host)) && <Button className="h-10" onClick={() => router.push(`/meetings/${m.id}/room`)}><Video /> {m.is_host ? (m.status === "live" ? "Rejoin" : "Start the meeting") : "Join now"}</Button>}
        {m.status === "scheduled" && !m.is_host && <span className="inline-flex h-10 items-center text-sm text-muted-foreground">You can join once the host starts it.</span>}
        {m.is_host && (m.status === "live" || m.status === "scheduled") && <Button variant="outline" className="h-10" disabled={busy === m.id} onClick={() => end(m)}>{m.status === "live" ? "End meeting" : "Cancel meeting"}</Button>}
        {m.is_host && m.status !== "cancelled" && <Button variant="ghost" className="h-10" onClick={() => setViewing(m.id)}>Who attended</Button>}
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Staff meetings" subtitle={canHost ? "Meet your teachers live. Call all of them, or just the ones you choose." : "Meetings your head or principal has called with you."}>
        {hostable && <Button className="h-10 sm:h-9" onClick={() => setScheduling(true)}><Plus /> Call a meeting</Button>}
      </PageHead>
      {canHost && !hostable && <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Meetings are called from All Schools, so you can choose which schools to include. Switch to All Schools to call one.</p>}

      {failed ? <ErrorBox message="We couldn't load the meetings." onRetry={() => { setMeetings(null); setFailed(false); setVersion((v) => v + 1); }} /> : !meetings ? <PageLoader /> : meetings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center"><Video className="size-6 text-muted-foreground" aria-hidden /><p className="text-xs text-muted-foreground">{canHost ? "No meetings yet. Call the first one." : "No meetings have been called with you yet."}</p></div>
      ) : (
        <>
          {live.length > 0 && <section aria-label="Live now" className="flex flex-col gap-3"><h2 className="font-heading text-lg font-semibold">Live now</h2><ul className="grid gap-3 lg:grid-cols-2">{live.map((m) => <Card key={m.id} m={m} />)}</ul></section>}
          {upcoming.length > 0 && <section aria-label="Upcoming" className="flex flex-col gap-3"><h2 className="font-heading text-lg font-semibold">Upcoming</h2><ul className="grid gap-3 lg:grid-cols-2">{upcoming.map((m) => <Card key={m.id} m={m} />)}</ul></section>}
          {past.length > 0 && <section aria-label="Past" className="flex flex-col gap-3"><h2 className="font-heading text-lg font-semibold">Past meetings</h2><ul className="grid gap-3 lg:grid-cols-2">{past.map((m) => <Card key={m.id} m={m} />)}</ul></section>}
        </>
      )}
      {scheduling && <ScheduleDialog onClose={() => setScheduling(false)} onCreated={() => { setScheduling(false); setVersion((v) => v + 1); }} />}
      {viewing !== null && <Attendance id={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
