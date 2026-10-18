"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react";
import { api, ApiError, LedgerAccount, StockItem } from "@/lib/api";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function kes(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

const CATEGORIES = ["Food", "Stationery", "Teaching materials", "Laboratory", "Cleaning", "Medical", "Uniforms", "Spares"];

function NewItemDialog({ accounts, onCreated }: { accounts: LedgerAccount[]; onCreated: (i: StockItem) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Food", unit: "", reorder_level: "10", unit_cost: "", account_id: "" });
  const expenseAccounts = accounts.filter((a) => a.type === "expense");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.account_id) return;
    setSubmitting(true);
    try {
      const item = await api.createStockItem(token, user.school_id, {
        name: form.name,
        category: form.category,
        unit: form.unit,
        reorder_level: Number(form.reorder_level),
        unit_cost: Number(form.unit_cost),
        account_id: Number(form.account_id),
      });
      toast.success(`${item.code} added`);
      setOpen(false);
      setForm({ name: "", category: "Food", unit: "", reorder_level: "10", unit_cost: "", account_id: "" });
      onCreated(item);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline"><Plus />New item</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>New stock item</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => v && setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Unit</Label>
            <Input required value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="bag, box, litre" />
          </div>
          <div className="grid gap-1.5">
            <Label>Reorder level</Label>
            <Input required type="number" min={0} value={form.reorder_level} onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Unit cost (KES)</Label>
            <Input required type="number" min={0.01} step="0.01" value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Expense account charged on issue</Label>
            <Select value={form.account_id} onValueChange={(v) => v && setForm((f) => ({ ...f, account_id: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{expenseAccounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ item, mode, onDone }: { item: StockItem; mode: "receive" | "issue"; onDone: (i: StockItem) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [department, setDepartment] = useState("Kitchen and catering");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !quantity) return;
    setSubmitting(true);
    try {
      if (mode === "receive") {
        await api.receiveStock(token, user.school_id, { item_id: item.id, quantity: Number(quantity) });
      } else {
        await api.issueStock(token, user.school_id, { item_id: item.id, quantity: Number(quantity), department });
      }
      const updated = { ...item, quantity: mode === "receive" ? item.quantity + Number(quantity) : item.quantity - Number(quantity) };
      toast.success(mode === "receive" ? "Stock received" : "Stock issued");
      setOpen(false);
      setQuantity("");
      onDone(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">{mode === "receive" ? <ArrowDownToLine /> : <ArrowUpFromLine />}{mode === "receive" ? "Receive" : "Issue"}</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "receive" ? "Receive stock" : "Issue stock"} · {item.name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Quantity ({item.unit})</Label>
            <Input required type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          {mode === "issue" && (
            <div className="grid gap-1.5">
              <Label>Issued to</Label>
              <Input required value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          )}
          <Button disabled={submitting} type="submit">{submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : mode === "receive" ? "Receive" : "Issue"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StoresPage() {
  const { user, token, loading } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([api.listStockItems(token, user.school_id), api.listLedgerAccounts(token, user.school_id)])
      .then(([i, a]) => { setItems(i); setAccounts(a); })
      .finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  if (loading || dataLoading) return <PageLoader />;
  if (!user) return null;

  function upsert(item: StockItem) {
    setItems((its) => (its.some((i) => i.id === item.id) ? its.map((i) => (i.id === item.id ? item : i)) : [item, ...its]));
  }

  const inventoryValue = items.reduce((a, i) => a + i.quantity * i.unit_cost, 0);
  const lowStock = items.filter((i) => i.quantity <= i.reorder_level);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stores" description="Inventory items, receipts and issues." action={<NewItemDialog accounts={accounts} onCreated={(i) => setItems((is) => [i, ...is])} />} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Inventory value</p><p className="font-heading text-xl font-semibold tabular-nums">{kes(inventoryValue)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Items at or below reorder level</p><p className={`font-heading text-xl font-semibold tabular-nums ${lowStock.length ? "text-destructive" : ""}`}>{lowStock.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Code</TableHead><TableHead>Item</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.code}</TableCell>
                  <TableCell>{i.name}<br /><span className="text-xs text-muted-foreground">{i.category}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{i.quantity} {i.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">{kes(i.unit_cost)}</TableCell>
                  <TableCell>{i.quantity <= i.reorder_level ? <Badge variant="destructive">Reorder</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <MovementDialog item={i} mode="receive" onDone={upsert} />
                      <MovementDialog item={i} mode="issue" onDone={upsert} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No stock items yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
