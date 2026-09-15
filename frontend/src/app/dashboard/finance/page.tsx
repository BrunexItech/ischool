"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2, Wallet } from "lucide-react";
import { api, ApiError, Expense, FinanceSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function FinancePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category: "", description: "", amount: "", date: "" });

  useEffect(() => {
    if (!loading && user && !["school_admin", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  function refresh() {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.getFinanceSummary(token, user.school_id).then(setSummary),
      api.listExpenses(token, user.school_id).then(setExpenses),
    ]).finally(() => setDataLoading(false));
  }

  useEffect(() => {
    refresh();
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.category || !form.description || !form.amount || !form.date) return;
    setSubmitting(true);
    try {
      await api.createExpense(token, user.school_id, {
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        date: form.date,
      });
      setForm({ category: "", description: "", amount: "", date: "" });
      toast.success("Expense recorded");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record expense");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteExpense(token, user.school_id, id);
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete expense");
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Finance" description="Income from fees vs. expenses — a clear picture of the school's money." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><ArrowUpCircle className="size-4.5" /></div>
            <div>
              <p className="text-2xl font-semibold">KES {(summary?.total_income ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total income (fees)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600"><ArrowDownCircle className="size-4.5" /></div>
            <div>
              <p className="text-2xl font-semibold">KES {(summary?.total_expenses ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total expenses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wallet className="size-4.5" /></div>
            <div>
              <p className={`text-2xl font-semibold ${(summary?.net ?? 0) < 0 ? "text-red-600" : ""}`}>KES {(summary?.net ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Net position</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4.5" /> Record an expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Input required placeholder="e.g. salaries, utilities, maintenance" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Amount (KES)</Label>
              <Input required type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input required type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Input required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Record expense"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {summary && summary.expenses_by_category.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Expenses by category</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {summary.expenses_by_category.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-sm">
                <span className="capitalize">{c.category}</span>
                <span className="font-medium">KES {c.total.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">All expenses</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                <TableCell className="capitalize">{e.category}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>KES {e.amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(e.id)}><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No expenses recorded yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
