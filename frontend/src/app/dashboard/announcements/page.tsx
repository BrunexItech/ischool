"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, ChevronDown, MapPin, Megaphone, Plus, RotateCw, Search, Send } from "lucide-react";
import { api, Announcement, AnnouncementAudience, ApiError, MyClass, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = { all: "Whole school", teachers: "Teachers", staff: "Staff", students: "Learners", parents: "Parents" };
const RECENT_DAYS = 30;

interface Loaded {
  announcements: Announcement[];
  classes: SchoolClass[];
  myClasses: MyClass[];
}

async function fetchAll(token: string, schoolId: number, isTeacher: boolean): Promise<{ data: Loaded; failed: boolean }> {
  let failed = false;
  const [announcements, classes, myClasses] = await Promise.all([
    api.listAnnouncements(token, schoolId).catch(() => {
      failed = true;
      return [] as Announcement[];
    }),
    api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
    isTeacher ? api.listMyClasses(token, schoolId).catch(() => [] as MyClass[]) : Promise.resolve([] as MyClass[]),
  ]);
  return { data: { announcements, classes, myClasses }, failed };
}

function ComposeDialog({ data, isTeacher, onClose, onPosted }: { data: Loaded; isTeacher: boolean; onClose: () => void; onPosted: (a: Announcement) => void }) {
  const { token, user } = useAuth();
  const audiences: AnnouncementAudience[] = isTeacher ? ["parents", "students"] : ["all", "teachers", "staff", "students", "parents"];
  const mine = new Set(data.myClasses.map((c) => c.class_id));
  const classOptions = isTeacher ? data.classes.filter((c) => mine.has(c.id)) : data.classes;
  const [audience, setAudience] = useState<AnnouncementAudience>(audiences[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classId, setClassId] = useState(isTeacher ? "" : "__all_classes__");
  const [isEvent, setIsEvent] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  const classEligible = audience === "students" || audience === "parents";
  const msgEligible = audience === "all" || audience === "parents";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    if (isTeacher && !classId) {
      toast.error("Choose which of your classes this is for");
      return;
    }
    setSaving(true);
    try {
      const result = await api.createAnnouncement(token, user.school_id, {
        title: title.trim(),
        body: body.trim(),
        audience,
        class_id: classEligible && classId && classId !== "__all_classes__" ? Number(classId) : undefined,
        event_date: isEvent && eventDate ? eventDate : undefined,
        event_end_date: isEvent && eventEndDate ? eventEndDate : undefined,
        location: isEvent && location.trim() ? location.trim() : undefined,
        send_sms: msgEligible && sendSms,
        send_email: msgEligible && sendEmail,
      });
      onPosted(result.announcement);
      toast.success(isEvent ? "Event posted" : "Announcement posted");
      if (msgEligible && sendSms) {
        if (result.sms_error) toast.warning(result.sms_error);
        else if (result.sms_sent > 0) toast.success(`SMS sent to ${result.sms_sent} guardian${result.sms_sent > 1 ? "s" : ""}`);
      }
      if (msgEligible && sendEmail) {
        if (result.email_error) toast.warning(result.email_error);
        else if (result.email_sent > 0) toast.success(`Email sent to ${result.email_sent} guardian${result.email_sent > 1 ? "s" : ""}`);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to post announcement");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Send to</Label>
              <Select value={audience} onValueChange={(v) => v && setAudience(v as AnnouncementAudience)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{audiences.map((a) => <SelectItem key={a} value={a}>{AUDIENCE_LABEL[a]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {classEligible && (
              <div className="grid gap-1.5">
                <Label>Class</Label>
                <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                  <SelectContent>
                    {!isTeacher && <SelectItem value="__all_classes__">Every class</SelectItem>}
                    {classOptions.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {isTeacher && <p className="-mt-2 text-xs text-muted-foreground">You can write to the learners or parents of your own classes. The head of institution sends school-wide announcements.</p>}
          <div className="grid gap-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
          <div className="grid gap-1.5"><Label>Message</Label><Textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={4} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={isEvent} onCheckedChange={setIsEvent} />
            <Label className="font-normal">This is also an event with a date</Label>
          </div>
          {isEvent && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5"><Label>Date</Label><Input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>End date (optional)</Label><Input type="date" min={eventDate} value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Place (optional)</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            </div>
          )}
          {msgEligible && (
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <label className="flex items-center gap-2"><Switch checked={sendSms} onCheckedChange={setSendSms} /> Also send by SMS to guardians on file</label>
              <label className="flex items-center gap-2"><Switch checked={sendEmail} onCheckedChange={setSendEmail} /> Also send by email to guardians on file</label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner size={16} className="text-current" /> : <Send />} {isEvent ? "Post event" : "Post announcement"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AnnouncementsPage() {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isTeacher = user?.role === "teacher";
  const canPost = isTeacher || user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());
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

  const split = useMemo(() => {
    const all = data?.announcements ?? [];
    const cutoff = now - RECENT_DAYS * 86400000;
    return { recent: all.filter((a) => new Date(a.created_at).getTime() >= cutoff), earlier: all.filter((a) => new Date(a.created_at).getTime() < cutoff) };
  }, [data, now]);

  if (!data) return failed ? null : <PageLoader />;

  const className = (id: number | null) => (id == null ? null : (data.classes.find((c) => c.id === id)?.name ?? "One class"));
  const q = search.trim().toLowerCase();
  const earlier = split.earlier.filter((a) => !q || `${a.title} ${a.body}`.toLowerCase().includes(q));
  const months = Array.from(
    earlier.reduce((m, a) => m.set(a.created_at.slice(0, 7), [...(m.get(a.created_at.slice(0, 7)) ?? []), a]), new Map<string, Announcement[]>()),
  ).sort(([a], [b]) => (a < b ? 1 : -1));

  const Card = ({ a }: { a: Announcement }) => {
    const long = a.body.length > 220;
    const expanded = open.has(a.id);
    const cls = className(a.class_id);
    return (
      <li className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
        {a.event_date ? (
          <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border bg-muted/40 py-1.5 text-center" aria-label={`Event on ${a.event_date}`}>
            <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">{new Date(a.event_date + "T12:00:00").toLocaleDateString("en-GB", { month: "short" })}</span>
            <span className="font-heading text-lg leading-none font-semibold tabular-nums">{new Date(a.event_date + "T12:00:00").getDate()}</span>
          </div>
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Megaphone className="size-5" /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{AUDIENCE_LABEL[a.audience]}</span>
            {cls && (a.audience === "students" || a.audience === "parents") && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">{cls}</span>}
            {a.event_date && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">Event</span>}
            <span>{new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
          <h3 className="mt-1.5 font-medium break-words">{a.title}</h3>
          <p className={`mt-1 text-sm break-words whitespace-pre-line text-muted-foreground ${long && !expanded ? "line-clamp-3" : ""}`}>{a.body}</p>
          {long && (
            <button type="button" className="mt-1 text-sm font-medium text-primary hover:underline" onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}>
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          {a.event_date && (
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> {new Date(a.event_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}{a.event_end_date ? ` to ${new Date(a.event_end_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}</span>
              {a.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {a.location}</span>}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Announcements</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isTeacher ? "Updates for you, and notes to the learners or parents of your classes." : "Share updates with your school community."}</p>
        </div>
        {canPost && <Button className="h-10 w-fit sm:h-9" onClick={() => setComposeOpen(true)}><Plus /> New announcement</Button>}
      </header>

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the announcements.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
        </div>
      ) : data.announcements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <Megaphone className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No announcements yet</p>
          {canPost && <Button size="sm" className="mt-2" onClick={() => setComposeOpen(true)}><Plus /> New announcement</Button>}
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 font-heading text-lg font-semibold sm:px-5">Recent</h2>
            {split.recent.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing in the last {RECENT_DAYS} days.</p> : <ul className="divide-y">{split.recent.map((a) => <Card key={a.id} a={a} />)}</ul>}
          </section>

          {split.earlier.length > 0 && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <button type="button" aria-expanded={showEarlier} aria-controls="earlier-announcements" onClick={() => setShowEarlier((s) => !s)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5">
                <span><span className="block font-heading text-lg font-semibold">Earlier announcements</span><span className="block text-sm text-muted-foreground">{split.earlier.length} older announcement{split.earlier.length === 1 ? "" : "s"}</span></span>
                <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${showEarlier ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {showEarlier && (
                <div id="earlier-announcements" className="border-t">
                  <div className="relative border-b p-3 sm:px-5">
                    <Search className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground sm:left-7" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search earlier announcements..." aria-label="Search earlier announcements" className="h-10 pl-8" />
                  </div>
                  {months.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing matches.</p> : months.map(([month, list]) => (
                    <div key={month}>
                      <p className="bg-muted/40 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5">{new Date(month + "-15T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
                      <ul className="divide-y">{list.map((a) => <Card key={a.id} a={a} />)}</ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {composeOpen && canPost && <ComposeDialog data={data} isTeacher={isTeacher} onClose={() => setComposeOpen(false)} onPosted={(a) => setData((d) => (d ? { ...d, announcements: [a, ...d.announcements] } : d))} />}
    </div>
  );
}
