"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Clock, MapPin, Plus, Trash2, User as UserIcon } from "lucide-react";
import { api, ApiError, SchoolClass, Staff, Subject, TimetableSlot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SUBJECT_COLORS = [
  "border-l-blue-500 bg-blue-500/5",
  "border-l-emerald-500 bg-emerald-500/5",
  "border-l-amber-500 bg-amber-500/5",
  "border-l-violet-500 bg-violet-500/5",
  "border-l-rose-500 bg-rose-500/5",
  "border-l-cyan-500 bg-cyan-500/5",
];

function colorFor(subjectId: number) {
  return SUBJECT_COLORS[subjectId % SUBJECT_COLORS.length];
}

function AddSlotDialog({
  classes,
  subjects,
  teachers,
  defaultClassId,
  onCreated,
}: {
  classes: SchoolClass[];
  subjects: Subject[];
  teachers: Staff[];
  defaultClassId: number | null;
  onCreated: (slot: TimetableSlot) => void;
}) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    classId: defaultClassId ? String(defaultClassId) : "",
    subjectId: "",
    teacherId: "",
    day: "0",
    start: "08:00",
    end: "09:00",
    room: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.classId || !form.subjectId) return;
    setSubmitting(true);
    try {
      const created = await api.createTimetableSlot(token, user.school_id, {
        class_id: Number(form.classId),
        subject_id: Number(form.subjectId),
        teacher_user_id: form.teacherId ? Number(form.teacherId) : undefined,
        day_of_week: Number(form.day),
        start_time: `${form.start}:00`,
        end_time: `${form.end}:00`,
        room: form.room || undefined,
      });
      onCreated(created);
      setOpen(false);
      setForm((f) => ({ ...f, subjectId: "", teacherId: "", room: "" }));
      toast.success("Period added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add period");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus /> Add period</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Add a timetable period</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select required value={form.classId} onValueChange={(v) => v && setForm((f) => ({ ...f, classId: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Select required value={form.subjectId} onValueChange={(v) => v && setForm((f) => ({ ...f, subjectId: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Teacher (optional)</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm((f) => ({ ...f, teacherId: v ?? "" }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => <SelectItem key={t.user_id} value={String(t.user_id)}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Day</Label>
            <Select required value={form.day} onValueChange={(v) => v && setForm((f) => ({ ...f, day: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Starts</Label>
              <Input required type="time" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Ends</Label>
              <Input required type="time" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Room (optional)</Label>
              <Input value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add period"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TimetablePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && user.role !== "head_of_institution" && user.role !== "super_admin" && user.role !== "group_principal" && user.role !== "secretary") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listClasses(token, user.school_id).then((cs) => {
        setClasses(cs);
        if (cs.length > 0) setClassId((prev) => prev ?? cs[0].id);
      }),
      api.listSubjects(token, user.school_id).then(setSubjects),
      api.listStaff(token, user.school_id).then((ss) => setTeachers(ss.filter((s) => s.role === "teacher"))),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  useEffect(() => {
    if (!token || !user?.school_id || classId === null) return;
    api.listTimetable(token, user.school_id, classId).then(setSlots);
  }, [token, user?.school_id, classId]);

  async function handleDelete(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteTimetableSlot(token, user.school_id, id);
      setSlots((s) => s.filter((slot) => slot.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove period");
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  const byDay = DAYS.map((_, i) => slots.filter((s) => s.day_of_week === i).sort((a, b) => a.start_time.localeCompare(b.start_time)));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Timetable" description="Build each class's weekly schedule — a class or teacher can never be double-booked." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Choose a class" /></SelectTrigger>
          <SelectContent>
            {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <AddSlotDialog key={classId} classes={classes} subjects={subjects} teachers={teachers} defaultClassId={classId} onCreated={(s) => setSlots((all) => [...all, s])} />
      </div>

      {classes.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Add a class first.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {DAYS.map((day, i) => (
            <div key={day} className="flex flex-col gap-2">
              <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day}</p>
              <div className="flex flex-col gap-2">
                {byDay[i].map((slot) => (
                  <Card key={slot.id} className={`border-l-4 shadow-none ${colorFor(slot.subject_id)}`}>
                    <CardContent className="flex flex-col gap-1 p-3">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold">{slot.subject_name}</p>
                        <button onClick={() => handleDelete(slot.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</p>
                      {slot.teacher_name && <p className="flex items-center gap-1 text-xs text-muted-foreground"><UserIcon className="size-3" /> {slot.teacher_name}</p>}
                      {slot.room && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {slot.room}</p>}
                    </CardContent>
                  </Card>
                ))}
                {byDay[i].length === 0 && (
                  <div className="flex min-h-16 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                    <CalendarClock className="mr-1.5 size-3.5" /> Free
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
