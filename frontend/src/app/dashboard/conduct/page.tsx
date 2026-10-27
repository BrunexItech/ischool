"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Plus, RotateCw, Search, ShieldAlert } from "lucide-react";
import { api, ApiError, ConductCategory, ConductReport, MyClass, SchoolClass, Student } from "@/lib/api";
import { ClassStudentPicker } from "@/components/ClassStudentPicker";
import { useAuth } from "@/lib/auth";
import { localDateStr } from "@/lib/dates";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DepartmentPulse } from "@/components/DepartmentPulse";
import { ViewOnly } from "@/components/oversight";

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
  return localDateStr();
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
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-10 sm:h-8">{report.status === "reviewed" ? "Edit response" : "Respond"}</Button>} />
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

interface Loaded {
  reports: ConductReport[];
  classes: SchoolClass[];
  students: Student[];
  myClasses: MyClass[];
}

async function fetchAll(token: string, schoolId: number, isTeacher: boolean): Promise<{ data: Loaded; failed: boolean }> {
  let failed = false;
  const [reports, classes, students, myClasses] = await Promise.all([
    api.listConductReports(token, schoolId).catch(() => {
      failed = true;
      return [] as ConductReport[];
    }),
    api.listClasses(token, schoolId).catch(() => [] as SchoolClass[]),
    api.listStudents(token, schoolId).catch(() => [] as Student[]),
    isTeacher ? api.listMyClasses(token, schoolId).catch(() => [] as MyClass[]) : Promise.resolve([] as MyClass[]),
  ]);
  return { data: { reports, classes, students, myClasses }, failed };
}

function FileDialog({ data, isTeacher, onClose, onFiled }: { data: Loaded; isTeacher: boolean; onClose: () => void; onFiled: (r: ConductReport) => void }) {
  const { token, user } = useAuth();
  const [form, setForm] = useState({ studentId: "", category: "disruption" as ConductCategory, description: "", actionTaken: "", incidentDate: todayStr() });
  const [saving, setSaving] = useState(false);
  // A teacher can report only learners in classes they teach, so only those classes are offered.
  const mine = new Set(data.myClasses.map((c) => c.class_id));
  const classes = isTeacher ? data.classes.filter((c) => mine.has(c.id)) : data.classes;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.studentId || !form.description.trim()) return;
    setSaving(true);
    try {
      const created = await api.createConductReport(token, user.school_id, {
        student_id: Number(form.studentId),
        category: form.category,
        description: form.description.trim(),
        action_taken: form.actionTaken.trim() || undefined,
        incident_date: form.incidentDate,
      });
      onFiled(created);
      toast.success("Conduct report filed");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to file report");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>File a conduct report</DialogTitle></DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <ClassStudentPicker classes={classes} students={data.students} value={form.studentId} onChange={(v) => setForm((f) => ({ ...f, studentId: v }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => v && setForm((f) => ({ ...f, category: v as ConductCategory }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(CATEGORY_LABEL) as ConductCategory[]).map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Date</Label><Input required type="date" value={form.incidentDate} max={todayStr()} onChange={(e) => e.target.value && setForm((f) => ({ ...f, incidentDate: e.target.value }))} /></div>
          </div>
          <div className="grid gap-1.5"><Label>What happened</Label><Textarea required rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid gap-1.5"><Label>Action taken (optional)</Label><Input placeholder="e.g. Verbal warning, moved seats" value={form.actionTaken} onChange={(e) => setForm((f) => ({ ...f, actionTaken: e.target.value }))} /></div>
          <p className="text-xs text-muted-foreground">This report is visible to school leadership, the learner and their guardian as soon as it is filed.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.studentId}>{saving && <Spinner size={16} className="text-current" />} File report</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ConductReportsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const isAdmin = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";
  const isTeacher = user?.role === "teacher";
  // Teachers and staff file conduct reports; leadership reads them and responds.
  const canReport = isTeacher || user?.role === "staff";
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [fileOpen, setFileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "reviewed">("all");
  const [category, setCategory] = useState<"all" | ConductCategory>("all");

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

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

  if (loading || !data) return failed ? null : <PageLoader />;

  const q = search.trim().toLowerCase();
  const shown = data.reports.filter(
    (r) => (status === "all" || r.status === status) && (category === "all" || r.category === category) && (!q || `${r.student_name} ${r.description} ${r.reported_by_name}`.toLowerCase().includes(q)),
  );
  const open = data.reports.filter((r) => r.status !== "reviewed").length;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Conduct Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Every report filed across the school." : "Reports you have filed for learners you teach."}
            {data.reports.length > 0 && <> {data.reports.length} in all{open > 0 ? `, ${open} awaiting a response` : ""}.</>}
          </p>
        </div>
        {canReport && <Button className="h-10 w-fit sm:h-9" onClick={() => setFileOpen(true)}><Plus /> File a report</Button>}
      </header>

      <DepartmentPulse dept="conduct" />

      {isAdmin && <ViewOnly label="Your part">Teachers file conduct reports. You read each one and respond to it, and your response is sent back to the teacher.</ViewOnly>}

      {data.reports.length > 0 && (
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_13rem]" aria-label="Filters">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports..." aria-label="Search reports" className="h-10 pl-8" />
          </div>
          <Select value={status} onValueChange={(v) => v && setStatus(v as typeof status)}>
            <SelectTrigger className="h-10 w-full" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="reviewed">Reviewed</SelectItem></SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => v && setCategory(v as typeof category)}>
            <SelectTrigger className="h-10 w-full" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All categories</SelectItem>{(Object.keys(CATEGORY_LABEL) as ConductCategory[]).map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
          </Select>
        </section>
      )}

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
          <AlertTriangle className="size-6 text-red-600" />
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the reports.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw /> Try again</Button>
        </div>
      ) : data.reports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No conduct reports filed yet</p>
          {canReport && <Button size="sm" className="mt-2" onClick={() => setFileOpen(true)}><Plus /> File a report</Button>}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No reports match.</p>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card divide-y">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium break-words">{r.student_name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{CATEGORY_LABEL[r.category]}</span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${r.status === "reviewed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>{r.status === "reviewed" ? "Reviewed" : "Open"}</span>
                    <span>{new Date(r.incident_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span>filed by {r.reported_by_name}</span>
                  </p>
                </div>
                {isAdmin && <RespondDialog report={r} onResponded={(u) => setData((d) => (d ? { ...d, reports: d.reports.map((x) => (x.id === u.id ? u : x)) } : d))} />}
              </div>
              <p className="text-sm break-words whitespace-pre-line">{r.description}</p>
              {r.action_taken && <p className="text-sm break-words text-muted-foreground">Action taken: {r.action_taken}</p>}
              {r.response && (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-2.5 text-sm">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <p className="break-words">{r.response}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {fileOpen && canReport && <FileDialog data={data} isTeacher={isTeacher} onClose={() => setFileOpen(false)} onFiled={(r) => setData((d) => (d ? { ...d, reports: [r, ...d.reports] } : d))} />}
    </div>
  );
}
