"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, BudgetLine } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function kes(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function BudgetInput({ line, year, onSaved }: { line: BudgetLine; year: number; onSaved: (l: BudgetLine) => void }) {
  const { token, user } = useAuth();
  const [value, setValue] = useState(String(line.budget || ""));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!token || !user?.school_id) return;
    const amount = Number(value) || 0;
    if (amount === line.budget) return;
    setSaving(true);
    try {
      const updated = await api.setBudget(token, user.school_id, { account_id: line.account_id, year, amount });
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save budget");
    } finally {
      setSaving(false);
    }
  }

  return <Input type="number" min={0} value={value} disabled={saving} onChange={(e) => setValue(e.target.value)} onBlur={save} className="w-32 text-right" />;
}

export default function BudgetsPage() {
  const { user, token, loading } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listBudgets(token, user.school_id, year).then(setLines).finally(() => setDataLoading(false));
  }, [token, user?.school_id, year]);

  if (loading) return <PageLoader />;
  if (!user) return null;

  function upsert(line: BudgetLine) {
    setLines((ls) => ls.map((l) => (l.account_id === line.account_id ? line : l)));
  }

  const totals = lines.reduce(
    (acc, l) => ({ budget: acc.budget + l.budget, actual: acc.actual + l.actual, committed: acc.committed + l.committed, available: acc.available + l.available }),
    { budget: 0, actual: 0, committed: 0, available: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Budgets"
        description="Spend ceilings per account, with actual and committed spend pulled live from the ledger and procurement."
        action={
          <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Budgeted</p><p className="font-heading text-xl font-semibold tabular-nums">{kes(totals.budget)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Actual</p><p className="font-heading text-xl font-semibold tabular-nums">{kes(totals.actual)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Committed</p><p className="font-heading text-xl font-semibold tabular-nums">{kes(totals.committed)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Available</p><p className={`font-heading text-xl font-semibold tabular-nums ${totals.available < 0 ? "text-destructive" : "text-emerald-600"}`}>{kes(totals.available)}</p></CardContent></Card>
      </div>

      {dataLoading ? (
        <PageLoader />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Actual</TableHead><TableHead className="text-right">Committed</TableHead><TableHead className="text-right">Available</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.account_id}>
                    <TableCell>{l.account_code} · {l.account_name}</TableCell>
                    <TableCell className="text-right"><BudgetInput line={l} year={year} onSaved={upsert} /></TableCell>
                    <TableCell className="text-right tabular-nums">{kes(l.actual)}</TableCell>
                    <TableCell className="text-right tabular-nums">{kes(l.committed)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${l.available < 0 ? "text-destructive" : ""}`}>{kes(l.available)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
