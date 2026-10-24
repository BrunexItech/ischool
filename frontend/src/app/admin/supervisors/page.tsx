"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, LogOut, Plus, ShieldCheck, UserPlus, X } from "lucide-react";
import { api, ApiError, School, Supervisor } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function SupervisorCard({ supervisor, schools, onChanged }: { supervisor: Supervisor; schools: School[]; onChanged: (s: Supervisor) => void }) {
  const { token } = useAuth();
  const [pickSchool, setPickSchool] = useState("");
  const [linking, setLinking] = useState(false);

  const linkableSchools = schools.filter((s) => !supervisor.schools.some((ls) => ls.id === s.id));

  async function handleLink() {
    if (!token || !pickSchool) return;
    setLinking(true);
    try {
      const updated = await api.linkSupervisorSchool(token, supervisor.id, Number(pickSchool));
      onChanged(updated);
      setPickSchool("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to link school");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(schoolId: number) {
    if (!token) return;
    try {
      const updated = await api.unlinkSupervisorSchool(token, supervisor.id, schoolId);
      onChanged(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to unlink school");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-heading text-base font-semibold">{supervisor.full_name}</p>
            <p className="text-xs text-muted-foreground">{supervisor.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {supervisor.schools.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 py-1 pr-1 pl-2.5">
              {s.name}
              <button onClick={() => handleUnlink(s.id)} className="rounded-full p-0.5 hover:bg-background/60">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {supervisor.schools.length === 0 && <p className="text-xs text-muted-foreground">No schools linked yet.</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-dashed pt-3">
          <Select value={pickSchool} onValueChange={(v) => setPickSchool(v ?? "")}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Link a school..." /></SelectTrigger>
            <SelectContent>
              {linkableSchools.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!pickSchool || linking} onClick={handleLink}>
            {linking ? <Spinner size={14} className="text-current" /> : <Plus />} Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSupervisorsPage() {
  const router = useRouter();
  const { user, token, loading, logout } = useAuth();
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "super_admin")) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.listSupervisors(token).then(setSupervisors).catch(() => setSupervisors([])),
      api.listSchools(token).then(setSchools).catch(() => setSchools([])),
    ]).finally(() => setDataLoading(false));
  }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const created = await api.createSupervisor(token, form);
      setSupervisors((s) => [...s, created]);
      setForm({ email: "", full_name: "", password: "" });
      toast.success(`${created.full_name} created`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create supervisor");
    } finally {
      setSubmitting(false);
    }
  }

  function handleChanged(updated: Supervisor) {
    setSupervisors((all) => all.map((s) => (s.id === updated.id ? updated : s)));
  }

  if (loading || !user || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader label="Loading supervisors..." />
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
          <Link href="/admin/schools"><Button variant="outline" size="sm"><ArrowLeft /> Schools</Button></Link>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut /> Log out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="size-6 text-violet-600" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Supervisors</h1>
            <p className="text-sm text-muted-foreground">Oversight accounts that can view every linked school in one place, and edit when they choose to.</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="size-4.5" /> Create a supervisor</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Full name</Label>
                <Input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Temporary password</Label>
                <Input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="sm:col-span-3">
                <Button disabled={submitting} type="submit">
                  {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Creating..." : "Create supervisor"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {supervisors.map((s) => (
            <SupervisorCard key={s.id} supervisor={s} schools={schools} onChanged={handleChanged} />
          ))}
          {supervisors.length === 0 && (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">No supervisors created yet.</CardContent></Card>
          )}
        </div>
      </main>
    </div>
  );
}
