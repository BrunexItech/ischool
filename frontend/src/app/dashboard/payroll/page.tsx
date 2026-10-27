"use client";

import { useModuleTab } from "@/lib/moduleTabs";
import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, Plus } from "lucide-react";
import { api, ApiError, EmploymentType, PayRun, PayrollProfile, Staff } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function kes(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function NewProfileDialog({ staff, onCreated }: { staff: Staff[]; onCreated: (p: PayrollProfile) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    employment_type: "non_teaching" as EmploymentType,
    basic_salary: "",
    house_allowance: "0",
    transport_allowance: "0",
    kra_pin: "",
    nssf_number: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.user_id) return;
    setSubmitting(true);
    try {
      const profile = await api.createPayrollProfile(token, user.school_id, {
        user_id: Number(form.user_id),
        employment_type: form.employment_type,
        basic_salary: Number(form.basic_salary),
        house_allowance: Number(form.house_allowance) || 0,
        transport_allowance: Number(form.transport_allowance) || 0,
        kra_pin: form.kra_pin.toUpperCase(),
        nssf_number: form.nssf_number,
      });
      toast.success(`${profile.staff_name} added to payroll`);
      setOpen(false);
      onCreated(profile);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add to payroll");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />Add to payroll</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Add staff to payroll</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>Staff member</Label>
            <Select value={form.user_id} onValueChange={(v) => v && setForm((f) => ({ ...f, user_id: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.user_id} value={String(s.user_id)}>{s.full_name} · {s.staff_number}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={form.employment_type} onValueChange={(v) => v && setForm((f) => ({ ...f, employment_type: v as EmploymentType }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teaching">Teaching</SelectItem>
                <SelectItem value="non_teaching">Non-teaching</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Basic salary</Label>
            <Input required type="number" min={1} value={form.basic_salary} onChange={(e) => setForm((f) => ({ ...f, basic_salary: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>House allowance</Label>
            <Input type="number" min={0} value={form.house_allowance} onChange={(e) => setForm((f) => ({ ...f, house_allowance: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Transport allowance</Label>
            <Input type="number" min={0} value={form.transport_allowance} onChange={(e) => setForm((f) => ({ ...f, transport_allowance: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>KRA PIN</Label>
            <Input required className="uppercase" value={form.kra_pin} onChange={(e) => setForm((f) => ({ ...f, kra_pin: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>NSSF number</Label>
            <Input required value={form.nssf_number} onChange={(e) => setForm((f) => ({ ...f, nssf_number: e.target.value }))} />
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add to payroll"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfilesTab() {
  const { token, user } = useAuth();
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([api.listPayrollProfiles(token, user.school_id), api.listStaff(token, user.school_id)])
      .then(([p, s]) => { setProfiles(p); setStaff(s); })
      .finally(() => setLoading(false));
  }, [token, user?.school_id]);

  const unenrolled = useMemo(() => {
    const enrolledIds = new Set(profiles.map((p) => p.user_id));
    return staff.filter((s) => !enrolledIds.has(s.user_id));
  }, [staff, profiles]);

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><NewProfileDialog staff={unenrolled} onCreated={(p) => setProfiles((ps) => [...ps, p])} /></div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Basic</TableHead><TableHead className="text-right">House</TableHead><TableHead className="text-right">Transport</TableHead><TableHead className="text-right">Gross</TableHead></TableRow></TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.staff_name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{p.employment_type.replace("_", "-")}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{kes(p.basic_salary)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kes(p.house_allowance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kes(p.transport_allowance)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{kes(p.basic_salary + p.house_allowance + p.transport_allowance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {profiles.length === 0 && <EmptyNote>No staff on payroll yet.</EmptyNote>}
        </CardContent>
      </Card>
    </div>
  );
}

function NewRunDialog({ onCreated }: { onCreated: (r: PayRun) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const run = await api.createPayRun(token, user.school_id, period);
      toast.success(`Pay run for ${period} created`);
      setOpen(false);
      onCreated(run);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create pay run");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />New pay run</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>New pay run</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Period</Label>
            <Input required type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <Button disabled={submitting} type="submit">{submitting && <Spinner size={16} className="text-current" />} {submitting ? "Creating..." : "Create pay run"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RunsTab() {
  const { token, user } = useAuth();
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const reload = () => {
    if (!token || !user?.school_id) return;
    api.listPayRuns(token, user.school_id).then(setRuns).finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function pay(id: number) {
    if (!token || !user?.school_id) return;
    try {
      const updated = await api.payRun(token, user.school_id, id);
      setRuns((rs) => rs.map((r) => (r.id === id ? updated : r)));
      toast.success("Salaries paid — posted to the ledger");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to pay run");
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><NewRunDialog onCreated={(r) => setRuns((rs) => [r, ...rs])} /></div>
      <div className="flex flex-col gap-3">
        {runs.map((r) => {
          const totalNet = r.lines.reduce((a, l) => a + l.net, 0);
          const totalGross = r.lines.reduce((a, l) => a + l.gross, 0);
          return (
            <Card key={r.id}>
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{r.period} · {r.lines.length} staff</p>
                    <p className="text-xs text-muted-foreground">Gross {kes(totalGross)} · Net {kes(totalNet)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "paid" ? "secondary" : "outline"} className="capitalize">{r.status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>{open[r.id] ? "Hide" : "View"} payslips</Button>
                    {r.status === "draft" && <Button size="sm" onClick={() => pay(r.id)}><Banknote />Pay salaries</Button>}
                  </div>
                </div>
                {open[r.id] && (
                  <Table className="mt-3">
                    <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">NSSF</TableHead><TableHead className="text-right">SHIF</TableHead><TableHead className="text-right">AHL</TableHead><TableHead className="text-right">PAYE</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {r.lines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.staff_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{kes(l.gross)}</TableCell>
                          <TableCell className="text-right tabular-nums">{kes(l.nssf)}</TableCell>
                          <TableCell className="text-right tabular-nums">{kes(l.shif)}</TableCell>
                          <TableCell className="text-right tabular-nums">{kes(l.ahl)}</TableCell>
                          <TableCell className="text-right tabular-nums">{kes(l.paye)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{kes(l.net)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
        {runs.length === 0 && <EmptyNote>No pay runs yet.</EmptyNote>}
      </div>
    </div>
  );
}

export default function PayrollPage() {
  const { user, loading } = useAuth();
  const view = useModuleTab("payroll");
  if (loading) return <PageLoader />;
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payroll" description="Staff salaries and Kenya statutory deductions (PAYE, NSSF, SHIF, housing levy)." />
      <Tabs value={view}>
        <TabsContent value="runs"><RunsTab /></TabsContent>
        <TabsContent value="profiles"><ProfilesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
