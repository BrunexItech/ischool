"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut, Trash2, UserCheck } from "lucide-react";
import { api, ApiError, PickupDropoffLog, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PickupDropoffPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [eventType, setEventType] = useState<"pickup" | "dropoff">("dropoff");
  const [personName, setPersonName] = useState("");
  const [notes, setNotes] = useState("");
  const [logs, setLogs] = useState<PickupDropoffLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && !["school_admin", "teacher", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listStudents(token, user.school_id).then(setStudents).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  function loadLogs(sid: string) {
    if (!token || !user?.school_id || !sid) return;
    api.listPickupDropoff(token, user.school_id, Number(sid)).then(setLogs);
  }

  useEffect(() => {
    loadLogs(studentId);
  }, [token, user?.school_id, studentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !studentId || !personName) return;
    setSubmitting(true);
    try {
      await api.logPickupDropoff(token, user.school_id, Number(studentId), { event_type: eventType, person_name: personName, notes: notes || undefined });
      setPersonName("");
      setNotes("");
      loadLogs(studentId);
      toast.success(`${eventType === "pickup" ? "Pickup" : "Drop-off"} logged`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to log entry");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !user?.school_id || !studentId) return;
    try {
      await api.deletePickupDropoff(token, user.school_id, Number(studentId), id);
      loadLogs(studentId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete entry");
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pickup / Drop-off Log" description="A transparent, timestamped record parents can see — kept for a year by default." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><UserCheck className="size-4.5" /> Log an entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={(v) => v && setStudentId(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name} ({s.admission_number})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Event</Label>
              <Select value={eventType} onValueChange={(v) => v && setEventType(v as "pickup" | "dropoff")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dropoff">Drop-off (arriving)</SelectItem>
                  <SelectItem value="pickup">Pickup (leaving)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Picked up / dropped off by</Label>
              <Input required placeholder="e.g. Jane Otieno (mother)" value={personName} onChange={(e) => setPersonName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={submitting || !studentId}>
                {submitting ? <Spinner size={16} className="text-current" /> : eventType === "pickup" ? <LogOut /> : <LogIn />}
                {submitting ? "Logging..." : `Log ${eventType}`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {studentId && (
        <Card>
          <CardHeader><CardTitle className="text-base">History for this student</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{new Date(l.occurred_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={l.event_type === "pickup" ? "default" : "secondary"} className="capitalize">{l.event_type}</Badge></TableCell>
                  <TableCell>{l.person_name}</TableCell>
                  <TableCell>{l.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {(user?.role === "school_admin" || user?.role === "super_admin") && (
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(l.id)}><Trash2 /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No entries yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
