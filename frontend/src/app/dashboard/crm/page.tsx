"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { api, ApiError, Lead, LeadStage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STAGES: { key: LeadStage; label: string }[] = [
  { key: "enquiry", label: "Enquiry" },
  { key: "visit_booked", label: "Visit booked" },
  { key: "applied", label: "Applied" },
  { key: "offer_sent", label: "Offer sent" },
  { key: "enrolled", label: "Enrolled" },
  { key: "lost", label: "Lost" },
];

function NewLeadDialog({ onCreated }: { onCreated: (lead: Lead) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    child_name: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
    grade_interested: "",
    source: "",
    notes: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const lead = await api.createLead(token, user.school_id, {
        child_name: form.child_name,
        guardian_name: form.guardian_name,
        guardian_phone: form.guardian_phone || undefined,
        guardian_email: form.guardian_email || undefined,
        grade_interested: form.grade_interested || undefined,
        source: form.source || undefined,
        notes: form.notes || undefined,
      });
      onCreated(lead);
      setForm({ child_name: "", guardian_name: "", guardian_phone: "", guardian_email: "", grade_interested: "", source: "", notes: "" });
      setOpen(false);
      toast.success(`${lead.child_name} added to the pipeline`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus /> New lead</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New admissions lead</DialogTitle>
          <DialogDescription>Starts in the Enquiry stage.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>Child&apos;s name</Label>
            <Input required value={form.child_name} onChange={(e) => set("child_name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Guardian name</Label>
            <Input required value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Grade interested in</Label>
            <Input placeholder="e.g. Grade 3" value={form.grade_interested} onChange={(e) => set("grade_interested", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Guardian phone</Label>
            <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Guardian email</Label>
            <Input type="email" value={form.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Source</Label>
            <Input placeholder="e.g. Website, Referral, Walk-in" value={form.source} onChange={(e) => set("source", e.target.value)} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeadDialog({ lead, open, onOpenChange, onUpdated, onDeleted }: { lead: Lead; open: boolean; onOpenChange: (v: boolean) => void; onUpdated: (lead: Lead) => void; onDeleted: (id: number) => void }) {
  const { token, user } = useAuth();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [admission, setAdmission] = useState(() => {
    const parts = lead.child_name.trim().split(/\s+/);
    return { admission_number: "", first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") };
  });

  async function saveNotes() {
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      const updated = await api.updateLead(token, user.school_id, lead.id, { notes });
      onUpdated(updated);
      toast.success("Notes saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteLead(token, user.school_id, lead.id);
      onDeleted(lead.id);
      onOpenChange(false);
      toast.success("Lead removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove lead");
    }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setConverting(true);
    try {
      await api.convertLead(token, user.school_id, lead.id, admission);
      onUpdated({ ...lead, stage: "enrolled" });
      onOpenChange(false);
      toast.success(`${lead.child_name} enrolled as a student`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to convert lead");
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lead.child_name}</DialogTitle>
          <DialogDescription>
            {lead.guardian_name}
            {lead.grade_interested ? ` · ${lead.grade_interested}` : ""}
            {lead.source ? ` · ${lead.source}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1 text-sm">
          {lead.guardian_phone && <p className="text-muted-foreground">{lead.guardian_phone}</p>}
          {lead.guardian_email && <p className="text-muted-foreground">{lead.guardian_email}</p>}
        </div>

        <div className="grid gap-1.5">
          <Label>Notes</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button size="sm" variant="outline" onClick={saveNotes} disabled={saving} className="w-fit">
            {saving && <Spinner size={14} className="text-current" />} Save notes
          </Button>
        </div>

        {lead.stage !== "enrolled" && lead.stage !== "lost" && (
          <form onSubmit={handleConvert} className="flex flex-col gap-3 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium"><UserCheck className="size-4" /> Convert to student</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Admission number</Label>
                <Input required value={admission.admission_number} onChange={(e) => setAdmission((a) => ({ ...a, admission_number: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">First name</Label>
                <Input required value={admission.first_name} onChange={(e) => setAdmission((a) => ({ ...a, first_name: e.target.value }))} />
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label className="text-xs">Last name</Label>
                <Input required value={admission.last_name} onChange={(e) => setAdmission((a) => ({ ...a, last_name: e.target.value }))} />
              </div>
            </div>
            <Button size="sm" type="submit" disabled={converting} className="w-fit">
              {converting && <Spinner size={14} className="text-current" />} Enrol as student
            </Button>
          </form>
        )}

        <DialogFooter>
          <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 /> Remove lead</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CrmPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [dragStage, setDragStage] = useState<LeadStage | null>(null);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "super_admin", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listLeads(token, user.school_id).then(setLeads).catch(() => setLeads([])).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  function replaceLead(updated: Lead) {
    setLeads((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
    setActiveLead((a) => (a?.id === updated.id ? updated : a));
  }

  function removeLead(id: number) {
    setLeads((ls) => ls.filter((l) => l.id !== id));
  }

  async function moveLead(leadId: number, stage: LeadStage) {
    if (!token || !user?.school_id) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === stage || lead.stage === "enrolled") return;
    try {
      const updated = await api.updateLead(token, user.school_id, leadId, { stage });
      replaceLead(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to move lead");
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admissions CRM" description="Track prospective families from first enquiry to enrolment." action={<NewLeadDialog onCreated={(l) => setLeads((ls) => [l, ...ls])} />} />

      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((stage) => {
          const items = leads.filter((l) => l.stage === stage.key);
          return (
            <Card
              key={stage.key}
              className={dragStage === stage.key ? "border-primary" : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setDragStage(stage.key);
              }}
              onDragLeave={() => setDragStage((s) => (s === stage.key ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const leadId = Number(e.dataTransfer.getData("text/plain"));
                setDragStage(null);
                if (leadId) moveLead(leadId, stage.key);
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">{stage.label}</CardTitle>
                <Badge variant="secondary">{items.length}</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {items.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(lead.id))}
                    onClick={() => setActiveLead(lead)}
                    className="cursor-grab rounded-lg border p-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40 active:cursor-grabbing"
                  >
                    <p className="font-medium">{lead.child_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.guardian_name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {lead.grade_interested && <Badge variant="outline" className="text-[0.65rem]">{lead.grade_interested}</Badge>}
                      {lead.source && <Badge variant="outline" className="text-[0.65rem]">{lead.source}</Badge>}
                    </div>
                  </button>
                ))}
                {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Drop a lead here</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeLead && (
        <LeadDialog
          key={activeLead.id}
          lead={activeLead}
          open
          onOpenChange={(v) => !v && setActiveLead(null)}
          onUpdated={replaceLead}
          onDeleted={removeLead}
        />
      )}
    </div>
  );
}
