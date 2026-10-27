"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, ApiError, Supplier } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function NewSupplierDialog({ onCreated }: { onCreated: (s: Supplier) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", kra_pin: "", category: "", phone: "", email: "", bank_account: "", etims_registered: false });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const supplier = await api.createSupplier(token, user.school_id, {
        ...form,
        kra_pin: form.kra_pin.toUpperCase(),
        bank_account: form.bank_account || undefined,
      });
      toast.success(`${supplier.name} registered`);
      setOpen(false);
      setForm({ name: "", kra_pin: "", category: "", phone: "", email: "", bank_account: "", etims_registered: false });
      onCreated(supplier);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to register supplier");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />New supplier</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Register supplier</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>Business name</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>KRA PIN</Label>
            <Input required className="uppercase" placeholder="P051234567X" value={form.kra_pin} onChange={(e) => setForm((f) => ({ ...f, kra_pin: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Input required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Food, Stationery" />
          </div>
          <div className="grid gap-1.5">
            <Label>Phone</Label>
            <Input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Bank account (optional)</Label>
            <Input value={form.bank_account} onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.etims_registered} onChange={(e) => setForm((f) => ({ ...f, etims_registered: e.target.checked }))} />
            Registered for eTIMS
          </label>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Registering..." : "Register"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SuppliersPage() {
  const { user, token, loading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listSuppliers(token, user.school_id).then(setSuppliers).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  async function toggleActive(s: Supplier) {
    if (!token || !user?.school_id) return;
    try {
      const updated = await api.updateSupplier(token, user.school_id, s.id, { is_active: !s.is_active });
      setSuppliers((ss) => ss.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update supplier");
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppliers"
        description="Registered vendors for procurement and payments."
        action={<NewSupplierDialog onCreated={(s) => setSuppliers((ss) => [s, ...ss])} />}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>KRA PIN</TableHead><TableHead>Category</TableHead>
                <TableHead>Contact</TableHead><TableHead>eTIMS</TableHead><TableHead>Status</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.kra_pin}</TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.phone}<br />{s.email}</TableCell>
                  <TableCell>{s.etims_registered ? <Badge variant="secondary">Registered</Badge> : <Badge variant="outline">No eTIMS</Badge>}</TableCell>
                  <TableCell><Badge variant={s.is_active ? "secondary" : "destructive"}>{s.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => toggleActive(s)}>{s.is_active ? "Deactivate" : "Activate"}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {suppliers.length === 0 && <EmptyNote>No suppliers registered yet.</EmptyNote>}
        </CardContent>
      </Card>
    </div>
  );
}
