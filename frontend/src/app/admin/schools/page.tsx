"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { GitBranch, GraduationCap, LogOut, Mail, Pencil, Plus, ShieldCheck, Users, UserCheck, Wallet } from "lucide-react";
import { api, ApiError, ModuleToggle, Plan, PlatformOverview, School } from "@/lib/api";
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
  pre_primary: "Pre-Primary (ECDE)",
  primary_section: "Primary School",
  secondary_section: "Secondary School",
  college_section: "College / TVET",
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
  library: "Library",
  exams: "Online Exams",
  sms: "Bulk SMS",
  lesson_plans: "Lesson Plans",
  admissions_crm: "Admissions CRM",
  school_calendar: "School Calendar",
  boarding: "Boarding",
  security: "Security",
  trips: "Trips",
  erp_finance: "Ledger (ERP finance)",
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

function EditSchoolDialog({ school, onUpdated }: { school: School; onUpdated: (school: School) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(school.name);
  const [customDomain, setCustomDomain] = useState(school.custom_domain ?? "");
  const [primaryColor, setPrimaryColor] = useState(school.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(school.secondary_color);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(school.name);
      setCustomDomain(school.custom_domain ?? "");
      setPrimaryColor(school.primary_color);
      setSecondaryColor(school.secondary_color);
      setLogoFile(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      let updated = await api.updateBranding(token, school.id, {
        name,
        custom_domain: customDomain || undefined,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      if (logoFile) {
        updated = await api.uploadSchoolLogo(token, school.id, logoFile);
      }
      onUpdated(updated);
      setOpen(false);
      toast.success(`${updated.name} updated`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update school");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm"><Pencil /></Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {school.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>School name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Custom domain (optional)</Label>
            <Input placeholder="school.example.com" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Primary color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="size-9 rounded border" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Secondary color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="size-9 rounded border" />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {school.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={school.logo_url} alt={school.name} className="h-9 rounded border bg-background p-1" />
              )}
              <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <Button disabled={saving} type="submit">
            {saving ? "Saving..." : "Save changes"}
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

  async function setAll(enabled: boolean) {
    if (!token) return;
    setLoading(true);
    const updated = await Promise.all(modules.map((m) => api.toggleModule(token, school.id, m.module_key, enabled)));
    setModules(updated);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size={18} />
      </div>
    );
  }

  const allEnabled = modules.every((m) => m.enabled);
  const allDisabled = modules.every((m) => !m.enabled);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={allEnabled} onClick={() => setAll(true)}>
          Enable all
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={allDisabled} onClick={() => setAll(false)}>
          Disable all
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <label key={m.module_key} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
            {MODULE_LABELS[m.module_key] ?? m.module_key}
            <Switch checked={m.enabled} onCheckedChange={(v) => toggle(m.module_key, v)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function DemoDataPanel({ school }: { school: School }) {
  const { token } = useAuth();
  const [hasDemo, setHasDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .demoDataStatus(token, school.id)
      .then((r) => setHasDemo(r.has_demo_data))
      .catch(() => setHasDemo(false))
      .finally(() => setLoading(false));
  }, [token, school.id]);

  async function generate() {
    if (!token) return;
    setBusy(true);
    try {
      const result = await api.generateDemoData(token, school.id);
      setHasDemo(true);
      toast.success(
        `Added ${result.students} students, ${result.staff} staff, ${result.classes} class. Demo teacher login: ${result.teacher_login.email} / ${result.teacher_login.password}`,
        { duration: 10000 }
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate demo data");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!token) return;
    if (!window.confirm(`Delete all demo data for ${school.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteDemoData(token, school.id);
      setHasDemo(false);
      toast.success("Demo data deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete demo data");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return hasDemo ? (
    <Button variant="destructive" size="sm" disabled={busy} onClick={remove}>
      {busy ? "Deleting..." : "Delete demo data"}
    </Button>
  ) : (
    <Button variant="outline" size="sm" disabled={busy} onClick={generate}>
      {busy ? "Generating..." : "Generate demo data"}
    </Button>
  );
}

export default function AdminSchoolsPage() {
  const router = useRouter();
  const { user, token, loading, logout } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [sendingReports, setSendingReports] = useState(false);

  async function handleSendWeeklyReports() {
    if (!token) return;
    setSendingReports(true);
    try {
      const result = await api.triggerWeeklyReports(token);
      toast.success(`Weekly reports sent — ${result.branch_reports_sent + result.group_reports_sent} emails across ${result.schools_processed} schools`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send weekly reports");
    } finally {
      setSendingReports(false);
    }
  }

  useEffect(() => {
    if (!loading && (!user || user.role !== "super_admin")) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.listSchools(token).then(setSchools).catch(() => setSchools([])),
      api.listPlans(token).then(setPlans).catch(() => setPlans([])),
      api.getPlatformOverview(token).then(setOverview).catch(() => setOverview(null)),
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
            <p className="text-sm font-semibold leading-none">Milai School</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/supervisors"><Button variant="outline" size="sm"><ShieldCheck /> Supervisors</Button></Link>
          <Button variant="outline" size="sm" disabled={sendingReports} onClick={handleSendWeeklyReports}>
            {sendingReports ? <Spinner size={14} className="text-current" /> : <Mail />} {sendingReports ? "Sending..." : "Send weekly reports now"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => logout(true)}><LogOut /> Log out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Overall</h1>
          <p className="mb-4 text-sm text-muted-foreground">Aggregated across every school on the platform — each school&apos;s own numbers are on its card below.</p>
          {overview && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><GraduationCap className="size-4.5" /></div>
                  <div>
                    <p className="font-heading text-2xl font-semibold tabular-nums">{overview.total_schools}</p>
                    <p className="text-xs text-muted-foreground">Schools on the platform</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="size-4.5" /></div>
                  <div>
                    <p className="font-heading text-2xl font-semibold tabular-nums">{overview.total_students.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total students</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserCheck className="size-4.5" /></div>
                  <div>
                    <p className="font-heading text-2xl font-semibold tabular-nums">{overview.total_teachers.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Teachers · {overview.total_active_staff.toLocaleString()} active staff total</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wallet className="size-4.5" /></div>
                  <div>
                    <p className="font-heading text-2xl font-semibold tabular-nums">{overview.overall_fee_collection_rate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Fee collection across all schools</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
            <p className="text-sm text-muted-foreground">Onboard schools and manage which modules they can use — each one gives its own distinct numbers.</p>
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
                    <div className="flex items-center gap-2">
                      <Badge variant={school.is_active ? "default" : "secondary"}>
                        {school.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <EditSchoolDialog school={school} onUpdated={handleSchoolUpdated} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <SubscriptionPanel school={school} plans={plans} onUpdated={handleSchoolUpdated} />
                  <ModulesPanel school={school} />
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className="text-sm text-muted-foreground">Sample data for demos</p>
                    <DemoDataPanel school={school} />
                  </div>
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
