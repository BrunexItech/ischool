"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, TrendingDown } from "lucide-react";
import { api, ApiError, FixedAsset, LedgerAccount } from "@/lib/api";
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

function NewAssetDialog({ accounts, onCreated }: { accounts: LedgerAccount[]; onCreated: (a: FixedAsset) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", account_id: "", acquisition_date: "", cost: "", residual_value: "0", useful_life_years: "5" });
  const assetAccounts = accounts.filter((a) => a.type === "asset");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.account_id) return;
    setSubmitting(true);
    try {
      const asset = await api.createFixedAsset(token, user.school_id, {
        name: form.name,
        account_id: Number(form.account_id),
        acquisition_date: form.acquisition_date,
        cost: Number(form.cost),
        residual_value: Number(form.residual_value) || 0,
        useful_life_years: Number(form.useful_life_years),
      });
      toast.success(`${asset.code} capitalised into the ledger`);
      setOpen(false);
      onCreated(asset);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add asset");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />New asset</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>New fixed asset</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid gap-1.5">
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Asset category (ledger account)</Label>
            <Select value={form.account_id} onValueChange={(v) => v && setForm((f) => ({ ...f, account_id: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{assetAccounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Acquisition date</Label>
            <Input required type="date" value={form.acquisition_date} onChange={(e) => setForm((f) => ({ ...f, acquisition_date: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Cost (KES)</Label>
            <Input required type="number" min={0.01} step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Residual value (KES)</Label>
            <Input type="number" min={0} value={form.residual_value} onChange={(e) => setForm((f) => ({ ...f, residual_value: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Useful life (years)</Label>
            <Input required type="number" min={1} max={50} value={form.useful_life_years} onChange={(e) => setForm((f) => ({ ...f, useful_life_years: e.target.value }))} />
          </div>
          <Button disabled={submitting} type="submit" className="col-span-2">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add asset"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RunDepreciationDialog({ onRun }: { onRun: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const run = await api.runDepreciation(token, user.school_id, period);
      toast.success(`Depreciation posted: ${kes(run.total_amount)}`);
      setOpen(false);
      onRun();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to run depreciation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline"><TrendingDown />Run depreciation</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Run monthly depreciation</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Posts straight-line depreciation for every active asset to the ledger.</p>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Period</Label>
            <Input required type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <Button disabled={submitting} type="submit">{submitting && <Spinner size={16} className="text-current" />} {submitting ? "Running..." : "Run depreciation"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AssetsPage() {
  const { user, token, loading } = useAuth();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const reload = () => {
    if (!token || !user?.school_id) return;
    Promise.all([api.listFixedAssets(token, user.school_id), api.listLedgerAccounts(token, user.school_id)])
      .then(([a, acc]) => { setAssets(a); setAccounts(acc); })
      .finally(() => setDataLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  async function dispose(id: number) {
    if (!token || !user?.school_id) return;
    try {
      const updated = await api.disposeFixedAsset(token, user.school_id, id);
      setAssets((as) => as.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to dispose asset");
    }
  }

  if (loading || dataLoading) return <PageLoader />;
  if (!user) return null;

  const totalCost = assets.reduce((a, x) => a + x.cost, 0);
  const totalNbv = assets.reduce((a, x) => a + x.net_book_value, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fixed Assets"
        description="Asset register with straight-line depreciation."
        action={
          <div className="flex gap-2">
            <RunDepreciationDialog onRun={reload} />
            <NewAssetDialog accounts={accounts} onCreated={(a) => setAssets((as) => [a, ...as])} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total cost</p><p className="font-heading text-xl font-semibold tabular-nums">{kes(totalCost)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Net book value</p><p className="font-heading text-xl font-semibold tabular-nums">{kes(totalNbv)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Code</TableHead><TableHead>Asset</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Accum. depreciation</TableHead><TableHead className="text-right">Net book value</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell>{a.name}<br /><span className="text-xs text-muted-foreground">{a.acquisition_date} · {a.useful_life_years}y</span></TableCell>
                  <TableCell className="text-right tabular-nums">{kes(a.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kes(a.accumulated_depreciation)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{kes(a.net_book_value)}</TableCell>
                  <TableCell><Badge variant={a.status === "active" ? "secondary" : "destructive"} className="capitalize">{a.status}</Badge></TableCell>
                  <TableCell>{a.status === "active" && <Button size="sm" variant="outline" onClick={() => dispose(a.id)}>Dispose</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {assets.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No fixed assets registered yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
