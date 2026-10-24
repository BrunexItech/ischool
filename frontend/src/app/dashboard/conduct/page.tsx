"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { api, ApiError, ConductCategory, ConductReport, SchoolClass, Student } from "@/lib/api";
import { ClassStudentPicker } from "@/components/ClassStudentPicker";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const CATEGORY_LABEL: Record<ConductCategory, string> = {
  disruption: "Disruption",
  disrespect: "Disrespect",
  bullying: "Bullying",
  fighting: "Fighting",
  dishonesty: "Dishonesty / Cheating",
  property_damage: "Property damage",
  dress_code: "Dress code",
  other: "Other",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function RespondDialog({ report, onResponded }: { report: ConductReport; onResponded: (r: ConductReport) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState(report.response ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !response.trim()) return;
    setSaving(true);
    try {
      const updated = await api.respondConductReport(token, user.school_id, report.id, response.trim());
      onResponded(updated);
      setOpen(false);
      toast.success("Response recorded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save response");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">{report.status === "reviewed" ? "Edit response" : "Respond"}</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>{report.student_name} — {CATEGORY_LABEL[report.category]}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{report.description}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label>Response / action taken</Label>
            <Textarea required rows={3} value={response} onChange={(e) => setResponse(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Spinner size={16} className="text-current" />} {saving ? "Saving..." : "Save response"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ConductReportsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [reports, setReports] = useState<ConductReport[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    studentId: "",
    category: "disruption" as ConductCategory,
    description: "",
    actionTaken: "",
    incidentDate: todayStr(),
  });

  const isAdmin = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";
  const canReport = isAdmin || user?.role === "teacher" || user?.role === "staff";

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listConductReports(token, user.school_id).then(setReports).catch(() => setReports([])),
      api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([])),
      api.listStudents(token, user.school_id).then(setStudents).catch(() => setStudents([])),
    ]).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.studentId || !form.description.trim()) return;
    setSubmitting(true);
    try {
      const created = await api.createConductReport(token, user.school_id, {
        student_id: Number(form.studentId),
        category: form.category,
        description: form.description.trim(),
        action_taken: form.actionTaken.trim() || undefined,
        incident_date: form.incidentDate,
      });
      setReports((r) => [created, ...r]);
      setForm({ studentId: "", category: "disruption", description: "", actionTaken: "", incidentDate: todayStr() });
      toast.success("Conduct report filed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to file report");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Conduct Reports" description="Record and track student behaviour concerns." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conduct Reports"
        description={
          isAdmin
            ? "Every report filed across the school — visible to the student and their guardian as soon as it's filed."
            : "Reports you've filed — also visible to school leadership, the student, and their guardian."
        }
      />

      {canReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4.5" /> File a report</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <ClassStudentPicker
                classes={classes}
                students={students}
                value={form.studentId}
                onChange={(v) => setForm((f) => ({ ...f, studentId: v }))}
              />
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm((f) => ({ ...f, category: v as ConductCategory }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABEL) as ConductCategory[]).map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Date</Label>
                <Input required type="date" value={form.incidentDate} onChange={(e) => setForm((f) => ({ ...f, incidentDate: e.target.value }))} />
              </div>
              <div className="col-span-full grid gap-1.5">
                <Label>What happened</Label>
                <Textarea required rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="col-span-full grid gap-1.5">
                <Label>Action taken (optional)</Label>
                <Input placeholder="e.g. Verbal warning, moved seats" value={form.actionTaken} onChange={(e) => setForm((f) => ({ ...f, actionTaken: e.target.value }))} />
              </div>
              <div className="col-span-full">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Filing..." : "File report"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {reports.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-col gap-2 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium">{r.student_name}</p>
                    <Badge variant="outline">{CATEGORY_LABEL[r.category]}</Badge>
                    <Badge variant={r.status === "reviewed" ? "secondary" : "outline"}>{r.status === "reviewed" ? "Reviewed" : "Open"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.incident_date + "T12:00:00").toLocaleDateString()} · Filed by {r.reported_by_name}
                  </p>
                </div>
                {isAdmin && <RespondDialog report={r} onResponded={(u) => setReports((rs) => rs.map((x) => (x.id === u.id ? u : x)))} />}
              </div>
              <p className="text-sm">{r.description}</p>
              {r.action_taken && <p className="text-sm text-muted-foreground">Action taken: {r.action_taken}</p>}
              {r.response && (
                <div className="mt-1 flex items-start gap-2 rounded-lg border bg-muted/40 p-2.5 text-sm">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <p>{r.response}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {reports.length === 0 && (
          <Card><CardContent className="flex h-24 items-center justify-center text-sm text-muted-foreground">No conduct reports filed yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
