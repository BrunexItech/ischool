"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { api, ApiError, CalendarEvent, CalendarEventType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EVENT_TYPES: { value: CalendarEventType; label: string; dot: string }[] = [
  { value: "meeting", label: "Meeting", dot: "bg-blue-500" },
  { value: "exam", label: "Exams", dot: "bg-red-500" },
  { value: "sports", label: "Sports", dot: "bg-amber-500" },
  { value: "admissions", label: "Admissions", dot: "bg-teal-500" },
  { value: "holiday", label: "Holiday", dot: "bg-emerald-500" },
  { value: "term", label: "Term", dot: "bg-violet-500" },
  { value: "trip_briefing", label: "Trip briefing", dot: "bg-cyan-500" },
  { value: "college", label: "College", dot: "bg-indigo-500" },
  { value: "other", label: "Other", dot: "bg-muted-foreground" },
];
const typeMeta = (t: CalendarEventType) => EVENT_TYPES.find((e) => e.value === t)!;

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-start
  const days = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(year, month, 1 - lead + i);
    return { date: d, inMonth: d.getMonth() === month };
  });
}
function eventsOn(events: CalendarEvent[], day: string) {
  return events.filter((e) => day >= e.start_date && day <= (e.end_date ?? e.start_date));
}

function EventForm({ defaultDate, onSaved }: { defaultDate: string; onSaved: (e: CalendarEvent) => void }) {
  const { token, user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    event_type: "meeting" as CalendarEventType,
    start_date: defaultDate,
    end_date: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.title || !form.start_date) return;
    setSubmitting(true);
    try {
      const created = await api.createCalendarEvent(token, user.school_id, {
        title: form.title,
        event_type: form.event_type,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        description: form.description || undefined,
      });
      onSaved(created);
      toast.success(`${created.title} added to the calendar`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add event");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 grid gap-1.5">
        <Label>Title</Label>
        <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </div>
      <div className="grid gap-1.5">
        <Label>Type</Label>
        <Select value={form.event_type} onValueChange={(v) => v && setForm((f) => ({ ...f, event_type: v as CalendarEventType }))}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div />
      <div className="grid gap-1.5">
        <Label>Starts</Label>
        <Input required type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
      </div>
      <div className="grid gap-1.5">
        <Label>Ends (optional)</Label>
        <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
      </div>
      <div className="col-span-2 grid gap-1.5">
        <Label>Details</Label>
        <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      <Button disabled={submitting} type="submit" className="col-span-2">
        {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add event"}
      </Button>
    </form>
  );
}

function NewEventDialog({ onCreated }: { onCreated: (e: CalendarEvent) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus /> New event</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>New calendar event</DialogTitle></DialogHeader>
        <EventForm
          defaultDate={iso(new Date())}
          onSaved={(e) => {
            onCreated(e);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function DayDialog({
  date,
  events,
  canEdit,
  open,
  onOpenChange,
  onCreated,
  onDeleted,
}: {
  date: string;
  events: CalendarEvent[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (e: CalendarEvent) => void;
  onDeleted: (id: number) => void;
}) {
  const { token, user } = useAuth();
  const [showForm, setShowForm] = useState(false);

  async function handleDelete(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteCalendarEvent(token, user.school_id, id);
      onDeleted(id);
      toast.success("Event removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove event");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-sm">
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${typeMeta(e.event_type).dot}`} />
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{typeMeta(e.event_type).label}</p>
                  {e.description && <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>}
                </div>
              </div>
              {canEdit && (
                <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(e.id)}><Trash2 /></Button>
              )}
            </div>
          ))}
          {events.length === 0 && !showForm && <p className="py-2 text-center text-sm text-muted-foreground">Nothing scheduled.</p>}
        </div>

        {canEdit && (
          showForm ? (
            <EventForm defaultDate={date} onSaved={(e) => { onCreated(e); setShowForm(false); }} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="w-fit"><Plus /> Add event</Button>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarPage() {
  const { user, token, loading } = useAuth();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const canEdit = user?.role === "head_of_institution" || user?.role === "group_principal";
  const monthEvents = useMemo(() => {
    const first = iso(new Date(cursor.year, cursor.month, 1));
    const last = iso(new Date(cursor.year, cursor.month + 1, 0));
    return events.filter((e) => e.start_date <= last && (e.end_date ?? e.start_date) >= first).sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  }, [events, cursor]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    const from = iso(grid[0].date);
    const to = iso(grid[grid.length - 1].date);
    api
      .listCalendarEvents(token, user.school_id, from, to)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setDataLoading(false));
  }, [token, user?.school_id, grid]);

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        description="Meetings, exams, holidays, trips — everything the school has scheduled."
        action={canEdit ? <NewEventDialog onCreated={(e) => setEvents((es) => [...es, e])} /> : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="size-10" aria-label="Previous month" onClick={() => setCursor((c) => { const m = c.month - 1; return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m }; })}><ChevronLeft /></Button>
        <p className="min-w-40 text-center text-sm font-medium">
          {new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </p>
        <Button variant="outline" size="icon" className="size-10" aria-label="Next month" onClick={() => setCursor((c) => { const m = c.month + 1; return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m }; })}><ChevronRight /></Button>
        <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }}>Today</Button>
        {dataLoading && <Spinner size={14} />}
        <div className="flex w-full flex-wrap gap-x-3 gap-y-1 sm:ml-auto sm:w-auto">
          {EVENT_TYPES.map((t) => (
            <span key={t.value} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={`size-2 rounded-full ${t.dot}`} /> {t.label}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="border-r py-2 last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map(({ date, inMonth }) => {
              const day = iso(date);
              const dayEvents = eventsOn(events, day);
              const isToday = day === iso(new Date());
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={`flex min-h-16 flex-col gap-1 border-r border-b p-1 text-left last:border-r-0 hover:bg-accent/40 sm:min-h-24 sm:p-1.5 ${inMonth ? "" : "bg-muted/30"}`}
                >
                  <span className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-primary text-primary-foreground" : inMonth ? "" : "text-muted-foreground"}`}>
                    {date.getDate()}
                  </span>
                  <div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                    {dayEvents.slice(0, 4).map((e) => <span key={e.id} className={`size-1.5 rounded-full ${typeMeta(e.event_type).dot}`} />)}
                  </div>
                  <div className="hidden flex-col gap-0.5 sm:flex">
                    {dayEvents.slice(0, 2).map((e) => (
                      <span key={e.id} className="flex items-center gap-1 truncate rounded bg-muted px-1 py-0.5 text-[0.65rem]">
                        <span className={`size-1.5 shrink-0 rounded-full ${typeMeta(e.event_type).dot}`} /> {e.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && <span className="text-[0.65rem] text-muted-foreground">+{dayEvents.length - 2} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="overflow-hidden rounded-xl border bg-card" aria-label="This month">
        <h2 className="border-b px-4 py-3 font-heading text-lg font-semibold sm:px-5">
          {new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}: what&apos;s on
        </h2>
        {monthEvents.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing scheduled this month.</p>
        ) : (
          <ul className="divide-y">
            {monthEvents.map((e) => {
              const start = new Date(e.start_date + "T12:00:00");
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setActiveDay(e.start_date)} className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5">
                    <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border bg-muted/40 py-1">
                      <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">{start.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                      <span className="font-heading text-lg leading-none font-semibold tabular-nums">{start.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium break-words">{e.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><span className={`size-2 rounded-full ${typeMeta(e.event_type).dot}`} /> {typeMeta(e.event_type).label}</span>
                        {e.end_date && e.end_date !== e.start_date && <span>until {new Date(e.end_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                      </span>
                      {e.description && <span className="mt-0.5 block text-xs break-words text-muted-foreground">{e.description}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeDay && (
        <DayDialog
          key={activeDay}
          date={activeDay}
          events={eventsOn(events, activeDay)}
          canEdit={canEdit}
          open
          onOpenChange={(v) => !v && setActiveDay(null)}
          onCreated={(e) => setEvents((es) => [...es, e])}
          onDeleted={(id) => setEvents((es) => es.filter((e) => e.id !== id))}
        />
      )}
    </div>
  );
}
