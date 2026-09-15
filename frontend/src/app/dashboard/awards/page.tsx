"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award as AwardIcon, Plus, Trash2 } from "lucide-react";
import { api, ApiError, Award, Staff, Student } from "@/lib/api";
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

const RECIPIENT_KIND = { student: "student", staff: "staff" } as const;

export default function AwardsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [awards, setAwards] = useState<Award[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    recipientKind: RECIPIENT_KIND.student as "student" | "staff",
    recipientId: "",
    title: "",
    description: "",
    category: "",
    date_awarded: "",
  });

  useEffect(() => {
    if (!loading && user && !["school_admin", "teacher", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listAwards(token, user.school_id).then(setAwards),
      api.listStudents(token, user.school_id).then(setStudents),
      api.listStaff(token, user.school_id).then(setStaff),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.recipientId || !form.title || !form.date_awarded) return;
    setSubmitting(true);
    try {
      const created = await api.createAward(token, user.school_id, {
        [form.recipientKind === "student" ? "student_id" : "staff_user_id"]: Number(form.recipientId),
        title: form.title,
        description: form.description || undefined,
        category: form.category || undefined,
        date_awarded: form.date_awarded,
      });
      setAwards((a) => [created, ...a]);
      setForm({ recipientKind: form.recipientKind, recipientId: "", title: "", description: "", category: "", date_awarded: "" });
      toast.success(`Award given to ${created.recipient_name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create award");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteAward(token, user.school_id, id);
      setAwards((a) => a.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete award");
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Awards & Recognition" description="Celebrate students and staff who stand out." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Awards & Recognition" description="Celebrate students and staff who stand out." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4.5" /> Give an award</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Recipient type</Label>
              <Select
                value={form.recipientKind}
                onValueChange={(v) => v && setForm((f) => ({ ...f, recipientKind: v as "student" | "staff", recipientId: "" }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Teacher / Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Recipient</Label>
              <Select value={form.recipientId} onValueChange={(v) => v && setForm((f) => ({ ...f, recipientId: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {form.recipientKind === "student"
                    ? students.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name} ({s.admission_number})</SelectItem>)
                    : staff.map((s) => <SelectItem key={s.user_id} value={String(s.user_id)}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Award title</Label>
              <Input required placeholder="e.g. Most Improved Student" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Category (optional)</Label>
              <Input placeholder="e.g. academic, sports, leadership" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Date awarded</Label>
              <Input required type="date" value={form.date_awarded} onChange={(e) => setForm((f) => ({ ...f, date_awarded: e.target.value }))} />
            </div>
            <div className="col-span-full grid gap-1.5">
              <Label>Description (optional)</Label>
              <Input placeholder="Why this recognition was given" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Give award"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><AwardIcon className="size-4.5" /> All awards</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {awards.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.recipient_name}</TableCell>
                <TableCell>{a.title}</TableCell>
                <TableCell>{a.category ? <Badge variant="outline" className="capitalize">{a.category}</Badge> : "—"}</TableCell>
                <TableCell>{new Date(a.date_awarded).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {(user?.role === "school_admin" || user?.role === "super_admin") && (
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(a.id)}><Trash2 /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {awards.length === 0 && (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No awards given yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
