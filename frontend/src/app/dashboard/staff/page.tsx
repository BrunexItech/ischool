"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError, Staff } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";
import { UserPlus } from "lucide-react";

export default function StaffPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "teacher" as "teacher" | "staff",
    staff_number: "",
    department: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin" && user.role !== "super_admin") {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listStaff(token, user.school_id).then(setStaff).catch(() => setStaff([])).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.createStaff(token, user.school_id, {
        email: form.email,
        full_name: form.full_name,
        password: form.password,
        role: form.role,
        staff_number: form.staff_number,
        department: form.department || undefined,
        phone: form.phone || undefined,
      });
      setStaff((s) => [...s, created]);
      setForm({ email: "", full_name: "", password: "", role: "teacher", staff_number: "", department: "", phone: "" });
      toast.success(`${created.full_name} added to staff`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add staff member");
    } finally {
      setSubmitting(false);
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Staff" description="Manage teacher and staff accounts for your school." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff" description="Manage teacher and staff accounts for your school." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a teacher or staff member</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Full name</Label>
              <Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Temporary password</Label>
              <Input required type="password" value={form.password} onChange={(e) => set("password", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => v && set("role", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Staff number</Label>
              <Input required value={form.staff_number} onChange={(e) => set("staff_number", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => set("department", e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button disabled={submitting} type="submit">
                <UserPlus /> {submitting ? "Adding..." : "Add staff member"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.staff_number}</TableCell>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{s.role}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{s.department ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell className="text-right">
                  <ResetPasswordDialog userId={s.user_id} label={s.full_name} />
                </TableCell>
              </TableRow>
            ))}
            {staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No staff added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
