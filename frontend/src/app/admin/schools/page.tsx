"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, LogOut, Plus } from "lucide-react";
import { api, ApiError, ModuleToggle, School } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/Spinner";

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
};

function OnboardDialog({ onCreated }: { onCreated: (school: School) => void }) {
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
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const school = await api.onboardSchool(token, form);
      onCreated(school);
      setForm({ ...form, name: "", slug: "", admin_email: "", admin_full_name: "", admin_password: "" });
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
  const [schoolsLoading, setSchoolsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== "super_admin")) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.listSchools(token).then(setSchools).catch(() => setSchools([])).finally(() => setSchoolsLoading(false));
  }, [token]);

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
          <OnboardDialog onCreated={(school) => setSchools((s) => [...s, school])} />
        </div>

        <div className="flex flex-col gap-4">
          {schools.map((school) => (
            <Card key={school.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{school.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {school.slug} · {school.country} · {school.currency}
                    </p>
                  </div>
                  <Badge variant={school.is_active ? "default" : "secondary"}>
                    {school.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
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
