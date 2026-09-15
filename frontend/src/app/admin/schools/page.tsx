"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitBranch, GraduationCap, LogOut, Plus } from "lucide-react";
import { api, ApiError, ModuleToggle, Plan, School } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, Spinner } from "@/components/Spinner";

const NO_PARENT = "none";
const NO_PLAN = "none";

const SUBSCRIPTION_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  trialing: "secondary",
  active: "default",
  past_due: "secondary",
  suspended: "destructive",
};

const MODULE_LABELS: Record<string, string> = {
  students_staff: "Students & Staff",
  attendance: "Attendance",
  results: "Results",
  fees: "Fees",
  live_classes: "Live Classes",
  communication: "Communication",
  transport: "Transport",
  meals: "Meals",
  awards: "Awards & Recognition",
  activities: "Activities & Competitions",
  finance: "Finance",
  pickup_dropoff: "Pickup / Drop-off Log",
  exams: "Online Exams",
};

function OnboardDialog({ schools, onCreated }: { schools: School[]; onCreated: (school: School) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    country: "Kenya",
    currency: "KES",
    timezone: "Africa/Nairobi",
    admin_email: "",
    admin_full_name: "",
    admin_password: "",
  });
  const [parentSchoolId, setParentSchoolId] = useState(NO_PARENT);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const school = await api.onboardSchool(token, {
        ...form,
        parent_school_id: parentSchoolId === NO_PARENT ? undefined : Number(parentSchoolId),
      });
      onCreated(school);
      setForm({ ...form, name: "", slug: "", admin_email: "", admin_full_name: "", admin_password: "" });
      setParentSchoolId(NO_PARENT);
      setOpen(false);
      toast.success(`${school.name} onboarded`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to onboard school");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus /> Onboard school</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Onboard a new school</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>School name</Label>
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Slug (subdomain)</Label>
            <Input required value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Currency</Label>
            <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Parent school (optional — makes this a branch/campus)</Label>
            <Select value={parentSchoolId} onValueChange={(v) => v && setParentSchoolId(v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>None — a standalone school</SelectItem>
                {schools.filter((s) => s.parent_school_id === null).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Admin full name</Label>
            <Input required value={form.admin_full_name} onChange={(e) => set("admin_full_name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Admin email</Label>
            <Input required type="email" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Admin password</Label>
            <Input required type="password" value={form.admin_password} onChange={(e) => set("admin_password", e.target.value)} />
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting ? "Creating..." : "Create school"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlansSection({ plans, onChanged }: { plans: Plan[]; onChanged: (plan: Plan) => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ name: "", price: "", currency: "USD", billing_period: "monthly" as "monthly" | "annual", max_students: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name || !form.price) return;
    setSubmitting(true);
    try {
      const plan = await api.createPlan(token, {
        name: form.name,
        price: Number(form.price),
        currency: form.currency,
        billing_period: form.billing_period,
        max_students: form.max_students ? Number(form.max_students) : undefined,
      });
      onChanged(plan);
      setForm({ name: "", price: "", currency: "USD", billing_period: "monthly", max_students: "" });
      toast.success(`${plan.name} plan created`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(plan: Plan) {
    if (!token) return;
    const updated = await api.updatePlan(token, plan.id, { is_active: !plan.is_active });
    onChanged(updated);
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Subscription plans</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <Input required placeholder="Plan name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-36" />
          <Input required type="number" min={0} placeholder="Price" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="w-24" />
          <Input placeholder="Currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="w-20" />
          <Select value={form.billing_period} onValueChange={(v) => v && setForm((f) => ({ ...f, billing_period: v as "monthly" | "annual" }))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" min={1} placeholder="Max students" value={form.max_students} onChange={(e) => setForm((f) => ({ ...f, max_students: e.target.value }))} className="w-32" />
          <Button size="sm" type="submit" disabled={submitting}><Plus /> {submitting ? "Adding..." : "Add plan"}</Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {plans.map((p) => (
            <Badge key={p.id} variant={p.is_active ? "secondary" : "outline"} className="gap-2">
              {p.name} — {p.currency} {p.price}/{p.billing_period === "monthly" ? "mo" : "yr"}
              <button type="button" className="text-xs underline" onClick={() => toggleActive(p)}>
                {p.is_active ? "retire" : "reactivate"}
              </button>
            </Badge>
          ))}
          {plans.length === 0 && <p className="text-sm text-muted-foreground">No plans yet — schools stay on their free trial until one is assigned.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionPanel({ school, plans, onUpdated }: { school: School; plans: Plan[]; onUpdated: (school: School) => void }) {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);

  async function handleStatusChange(status: string) {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.updateSubscription(token, school.id, { subscription_status: status });
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update subscription");
    } finally {
      setSaving(false);
    }
  }

  async function handlePlanChange(planId: string) {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.updateSubscription(token, school.id, { plan_id: planId === NO_PLAN ? null : Number(planId) });
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update subscription");
    } finally {
      setSaving(false);
    }
  }

  const trialEnds = new Date(school.trial_ends_at);
  const planName = plans.find((p) => p.id === school.plan_id)?.name;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
      <Badge variant={SUBSCRIPTION_STATUS_VARIANT[school.subscription_status]} className="capitalize">
        {school.subscription_status.replace("_", " ")}
      </Badge>
      {school.subscription_status === "trialing" && (
        <span className="text-xs text-muted-foreground">Trial ends {trialEnds.toLocaleDateString()}</span>
      )}
      <Select value={school.subscription_status} onValueChange={(v) => v && handleStatusChange(v)} disabled={saving}>
        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="trialing">Trialing</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="past_due">Past due</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
      </Select>
      <Select value={school.plan_id ? String(school.plan_id) : NO_PLAN} onValueChange={(v) => v && handlePlanChange(v)} disabled={saving}>
        <SelectTrigger className="w-40"><SelectValue placeholder="No plan">{planName ?? "No plan"}</SelectValue></SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PLAN}>No plan</SelectItem>
          {plans.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ModulesPanel({ school }: { school: School }) {
  const { token } = useAuth();
  const [modules, setModules] = useState<ModuleToggle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.listModules(token, school.id).then(setModules).catch(() => setModules([])).finally(() => setLoading(false));
  }, [token, school.id]);

  async function toggle(moduleKey: string, enabled: boolean) {
    if (!token) return;
    const updated = await api.toggleModule(token, school.id, moduleKey, enabled);
    setModules((mods) => mods.map((m) => (m.module_key === moduleKey ? updated : m)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size={18} />
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((m) => (
        <label key={m.module_key} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
          {MODULE_LABELS[m.module_key] ?? m.module_key}
          <Switch checked={m.enabled} onCheckedChange={(v) => toggle(m.module_key, v)} />
        </label>
      ))}
    </div>
  );
}

export default function AdminSchoolsPage() {
  const router = useRouter();
  const { user, token, loading, logout } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== "super_admin")) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.listSchools(token).then(setSchools).catch(() => setSchools([])),
      api.listPlans(token).then(setPlans).catch(() => setPlans([])),
    ]).finally(() => setSchoolsLoading(false));
  }, [token]);

  function handlePlanChanged(plan: Plan) {
    setPlans((ps) => (ps.some((p) => p.id === plan.id) ? ps.map((p) => (p.id === plan.id ? plan : p)) : [...ps, plan]));
  }

  function handleSchoolUpdated(updated: School) {
    setSchools((ss) => ss.map((s) => (s.id === updated.id ? updated : s)));
  }

  if (loading || !user || schoolsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader label="Loading schools console..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">iSchool</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut /> Log out</Button>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
            <p className="text-sm text-muted-foreground">Onboard schools and manage which modules they can use.</p>
          </div>
          <OnboardDialog schools={schools} onCreated={(school) => setSchools((s) => [...s, school])} />
        </div>

        <PlansSection plans={plans} onChanged={handlePlanChanged} />

        <div className="flex flex-col gap-4">
          {schools
            .filter((s) => s.parent_school_id === null)
            .flatMap((parent) => [parent, ...schools.filter((s) => s.parent_school_id === parent.id)])
            .map((school) => (
              <Card key={school.id} className={school.parent_school_id !== null ? "ml-6 border-dashed" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {school.parent_school_id !== null && <GitBranch className="size-4 text-muted-foreground" />}
                        {school.name}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {school.slug} · {school.country} · {school.currency}
                        {school.branch_count > 0 && ` · ${school.branch_count} branch${school.branch_count > 1 ? "es" : ""}`}
                      </p>
                    </div>
                    <Badge variant={school.is_active ? "default" : "secondary"}>
                      {school.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <SubscriptionPanel school={school} plans={plans} onUpdated={handleSchoolUpdated} />
                  <ModulesPanel school={school} />
                </CardContent>
              </Card>
            ))}
          {schools.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No schools onboarded yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
