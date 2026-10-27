"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Package, Plus, Truck, X } from "lucide-react";
import { api, ApiError, LedgerAccount, PurchaseOrder, Requisition, Supplier } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function kes(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

const REQ_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  approved: "secondary",
  declined: "destructive",
};
const PO_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  issued: "outline",
  received: "secondary",
  cancelled: "destructive",
};

function NewRequisitionDialog({ accounts, onCreated }: { accounts: LedgerAccount[]; onCreated: (r: Requisition) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ department: "", account_id: "", description: "", quantity: "1", unit_cost: "" });
  const expenseAccounts = accounts.filter((a) => a.type === "expense" || a.type === "asset");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.account_id) return;
    setSubmitting(true);
    try {
      const req = await api.createRequisition(token, user.school_id, {
        department: form.department,
        account_id: Number(form.account_id),
        description: form.description,
        quantity: Number(form.quantity),
        unit_cost: Number(form.unit_cost),
      });
      toast.success(`${req.reference} submitted for approval`);
      setOpen(false);
      setForm({ department: "", account_id: "", description: "", quantity: "1", unit_cost: "" });
      onCreated(req);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to submit requisition");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />New requisition</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>New purchase requisition</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Department</Label>
            <Input required value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Budget line</Label>
            <Select value={form.account_id} onValueChange={(v) => v && setForm((f) => ({ ...f, account_id: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{expenseAccounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Description</Label>
            <Input required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Quantity</Label>
            <Input required type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Unit cost (KES)</Label>
            <Input required type="number" min={0.01} step="0.01" value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
          </div>
          <p className="col-span-2 text-sm text-muted-foreground">
            Total: {kes((Number(form.quantity) || 0) * (Number(form.unit_cost) || 0))}
          </p>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Submitting..." : "Submit for approval"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IssueLpoDialog({ requisition, suppliers, onIssued }: { requisition: Requisition; suppliers: Supplier[]; onIssued: (po: PurchaseOrder) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !supplierId || !deliveryDate) return;
    setSubmitting(true);
    try {
      const po = await api.issuePurchaseOrder(token, user.school_id, { requisition_id: requisition.id, supplier_id: Number(supplierId), delivery_date: deliveryDate });
      toast.success(`${po.reference} issued`);
      setOpen(false);
      onIssued(po);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to issue LPO");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Truck />Issue LPO</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Issue local purchase order</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={(v) => v && setSupplierId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a supplier" /></SelectTrigger>
              <SelectContent>{suppliers.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Delivery by</Label>
            <Input required type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
          <Button disabled={submitting} type="submit">{submitting && <Spinner size={16} className="text-current" />} {submitting ? "Issuing..." : "Issue LPO"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequisitionsTab({ suppliers, onPoIssued }: { suppliers: Supplier[]; onPoIssued: (po: PurchaseOrder) => void }) {
  const { token, user } = useAuth();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const accountByI = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const reload = () => {
    if (!token || !user?.school_id) return;
    Promise.all([api.listRequisitions(token, user.school_id), api.listLedgerAccounts(token, user.school_id)])
      .then(([r, a]) => { setRequisitions(r); setAccounts(a); })
      .finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function act(fn: (t: string, s: number, id: number) => Promise<Requisition>, id: number, label: string) {
    if (!token || !user?.school_id) return;
    try {
      const updated = await fn(token, user.school_id, id);
      setRequisitions((rs) => rs.map((r) => (r.id === id ? updated : r)));
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><NewRequisitionDialog accounts={accounts} onCreated={(r) => setRequisitions((rs) => [r, ...rs])} /></div>
      <div className="flex flex-col gap-2">
        {requisitions.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div>
                <p className="text-sm font-medium">{r.reference} · {r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {r.department} · {accountByI.get(r.account_id)?.name ?? ""} · {r.quantity} × {kes(r.unit_cost)} = {kes(r.total)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={REQ_BADGE[r.status]} className="capitalize">{r.status}</Badge>
                {r.status === "submitted" && ["head_of_institution", "group_principal", "super_admin"].includes(user?.role ?? "") && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => act(api.approveRequisition, r.id, "Approved")}><Check />Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(api.declineRequisition, r.id, "Declined")}><X />Decline</Button>
                  </>
                )}
                {r.status === "approved" && <IssueLpoDialog requisition={r} suppliers={suppliers} onIssued={onPoIssued} />}
              </div>
            </CardContent>
          </Card>
        ))}
        {requisitions.length === 0 && <EmptyNote>No requisitions yet.</EmptyNote>}
      </div>
    </div>
  );
}

function PurchaseOrdersTab({ purchaseOrders, suppliers, onUpdated }: { purchaseOrders: PurchaseOrder[]; suppliers: Supplier[]; onUpdated: (po: PurchaseOrder) => void }) {
  const { token, user } = useAuth();
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  async function act(fn: (t: string, s: number, id: number) => Promise<PurchaseOrder>, id: number, label: string) {
    if (!token || !user?.school_id) return;
    try {
      const updated = await fn(token, user.school_id, id);
      onUpdated(updated);
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {purchaseOrders.map((po) => (
        <Card key={po.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div>
              <p className="text-sm font-medium">{po.reference} · {supplierById.get(po.supplier_id)?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Delivery by {po.delivery_date} · {kes(po.total)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={PO_BADGE[po.status]} className="capitalize">{po.status}</Badge>
              {po.status === "issued" && (
                <>
                  <Button size="sm" onClick={() => act(api.receivePurchaseOrder, po.id, "Received — posted to the ledger")}><Package />Receive</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(api.cancelPurchaseOrder, po.id, "Cancelled")}>Cancel</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {purchaseOrders.length === 0 && <EmptyNote>No purchase orders yet.</EmptyNote>}
    </div>
  );
}

export default function ProcurementPage() {
  const { user, token, loading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([api.listSuppliers(token, user.school_id), api.listPurchaseOrders(token, user.school_id)])
      .then(([s, po]) => { setSuppliers(s); setPurchaseOrders(po); })
      .finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  if (loading || dataLoading) return <PageLoader />;
  if (!user) return null;

  function upsertPo(po: PurchaseOrder) {
    setPurchaseOrders((pos) => (pos.some((p) => p.id === po.id) ? pos.map((p) => (p.id === po.id ? po : p)) : [po, ...pos]));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Procurement" description="Requisitions, approvals and purchase orders." />
      <Tabs defaultValue="requisitions">
        <TabsList>
          <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
          <TabsTrigger value="orders">Purchase orders</TabsTrigger>
        </TabsList>
        <TabsContent value="requisitions"><RequisitionsTab suppliers={suppliers} onPoIssued={upsertPo} /></TabsContent>
        <TabsContent value="orders"><PurchaseOrdersTab purchaseOrders={purchaseOrders} suppliers={suppliers} onUpdated={upsertPo} /></TabsContent>
      </Tabs>
    </div>
  );
}
