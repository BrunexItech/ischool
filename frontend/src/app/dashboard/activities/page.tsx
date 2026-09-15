"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Trophy, Users } from "lucide-react";
import { api, ApiError, Activity, ActivityDetail, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function ManageParticipantsDialog({ activity, students, onChanged }: { activity: Activity; students: Student[]; onChanged: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    if (!token || !user?.school_id) return;
    api.getActivity(token, user.school_id, activity.id).then(setDetail);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !studentId) return;
    setSubmitting(true);
    try {
      await api.addActivityParticipant(token, user.school_id, activity.id, { student_id: Number(studentId), role: role || undefined });
      setStudentId("");
      setRole("");
      load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add participant");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(sid: number) {
    if (!token || !user?.school_id) return;
    await api.removeActivityParticipant(token, user.school_id, activity.id, sid);
    load();
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline"><Users /> Participants ({activity.participant_count})</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activity.name} — participants</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <Select value={studentId} onValueChange={(v) => v && setStudentId(v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Student" /></SelectTrigger>
            <SelectContent>
              {students.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Role (optional)" value={role} onChange={(e) => setRole(e.target.value)} className="w-40" />
          <Button size="sm" type="submit" disabled={submitting || !studentId}>{submitting ? "Adding..." : "Add"}</Button>
        </form>
        <div className="flex flex-col gap-2">
          {detail?.participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>{p.student_name}{p.role ? ` — ${p.role}` : ""}</span>
              <Button variant="ghost" size="icon-xs" onClick={() => handleRemove(p.student_id)}><Trash2 /></Button>
            </div>
          ))}
          {detail && detail.participants.length === 0 && <p className="text-sm text-muted-foreground">No participants recorded yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ActivitiesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", date: "", description: "" });

  useEffect(() => {
    if (!loading && user && !["school_admin", "teacher", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  function refresh() {
    if (!token || !user?.school_id) return;
    api.listActivities(token, user.school_id).then(setActivities);
  }

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([api.listActivities(token, user.school_id).then(setActivities), api.listStudents(token, user.school_id).then(setStudents)]).finally(() =>
      setDataLoading(false)
    );
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.name || !form.date) return;
    setSubmitting(true);
    try {
      const created = await api.createActivity(token, user.school_id, {
        name: form.name,
        category: form.category || undefined,
        date: form.date,
        description: form.description || undefined,
      });
      setActivities((a) => [created, ...a]);
      setForm({ name: "", category: "", date: "", description: "" });
      toast.success(`${created.name} added`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create activity");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteActivity(token, user.school_id, id);
      setActivities((a) => a.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete activity");
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Activities & Competitions" description="Track events and who took part — sports, academics, arts, and clubs." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activities & Competitions" description="Track events and who took part — sports, academics, arts, and clubs." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4.5" /> Add an activity</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input required placeholder="e.g. Inter-school Debate Championship" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Category (optional)</Label>
              <Input placeholder="e.g. sports, academic, arts, clubs" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input required type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Description (optional)</Label>
              <Input placeholder="Short description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add activity"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Trophy className="size-4.5" /> All activities</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {activities.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.date).toLocaleDateString()} {a.category && <Badge variant="outline" className="ml-1 capitalize">{a.category}</Badge>}
                </p>
                {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <ManageParticipantsDialog activity={a} students={students} onChanged={refresh} />
                {(user?.role === "school_admin" || user?.role === "super_admin") && (
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(a.id)}><Trash2 /></Button>
                )}
              </div>
            </div>
          ))}
          {activities.length === 0 && <p className="text-sm text-muted-foreground">No activities recorded yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
