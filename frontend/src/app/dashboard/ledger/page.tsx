"use client";

import { useModuleTab } from "@/lib/moduleTabs";
import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, AccountType, ApiError, BalanceSheet, IncomeStatement, JournalEntry, LedgerAccount, TrialBalanceRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function kes(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

const TYPE_BADGE: Record<AccountType, "default" | "secondary" | "destructive" | "outline"> = {
  asset: "default",
  liability: "destructive",
  equity: "secondary",
  income: "secondary",
  expense: "outline",
};

function ChartOfAccountsTab() {
  const { token, user } = useAuth();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listLedgerAccounts(token, user.school_id).then(setAccounts).finally(() => setLoading(false));
  }, [token, user?.school_id]);

  if (loading) return <PageLoader />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono">{a.code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell><Badge variant={TYPE_BADGE[a.type]} className="capitalize">{a.type}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{kes(a.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewEntryDialog({ accounts, onCreated }: { accounts: LedgerAccount[]; onCreated: (e: JournalEntry) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([
    { account_id: "", debit: "", credit: "" },
    { account_id: "", debit: "", credit: "" },
  ]);

  const totalDebit = lines.reduce((a, l) => a + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((a, l) => a + (Number(l.credit) || 0), 0);
  const balanced = lines.length >= 2 && totalDebit > 0 && totalDebit === totalCredit;

  function updateLine(i: number, patch: Partial<{ account_id: string; debit: string; credit: string }>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !balanced) {
      if (!balanced) toast.error("Debits and credits must balance before posting");
      return;
    }
    setSubmitting(true);
    try {
      const entry = await api.createJournalEntry(token, user.school_id, {
        entry_date: entryDate,
        reference,
        memo,
        lines: lines
          .filter((l) => l.account_id)
          .map((l) => ({ account_id: Number(l.account_id), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      });
      toast.success(`${entry.reference} posted`);
      setOpen(false);
      setReference("");
      setMemo("");
      setLines([{ account_id: "", debit: "", credit: "" }, { account_id: "", debit: "", credit: "" }]);
      onCreated(entry);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to post entry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />New journal entry</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>New journal entry</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input required type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Reference</Label>
              <Input required value={reference} onChange={(e) => setReference(e.target.value)} placeholder="JV-001" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Memo</Label>
            <Input required value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px] gap-2">
                <Select value={line.account_id} onValueChange={(v) => v && updateLine(i, { account_id: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min={0} placeholder="Debit" value={line.debit} onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })} />
                <Input type="number" min={0} placeholder="Credit" value={line.credit} onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })} />
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setLines((ls) => [...ls, { account_id: "", debit: "", credit: "" }])}>
              <Plus />Add line
            </Button>
          </div>

          <div className={`flex items-center justify-between rounded-lg border p-2 text-sm ${balanced ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
            <span>Debit {kes(totalDebit)}</span>
            <span>Credit {kes(totalCredit)}</span>
            <Badge variant={balanced ? "secondary" : "destructive"}>{balanced ? "Balanced" : "Unbalanced"}</Badge>
          </div>

          <Button disabled={submitting || !balanced} type="submit">
            {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Posting..." : "Post entry"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JournalTab() {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    if (!token || !user?.school_id) return;
    Promise.all([api.listJournalEntries(token, user.school_id), api.listLedgerAccounts(token, user.school_id)])
      .then(([e, a]) => { setEntries(e); setAccounts(a); })
      .finally(() => setLoading(false));
  };
  useEffect(reload, [token, user?.school_id]);

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NewEntryDialog accounts={accounts} onCreated={(e) => setEntries((es) => [e, ...es])} />
      </div>
      <div className="flex flex-col gap-3">
        {entries.map((e) => (
          <Card key={e.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm">{e.reference} · {e.memo}</CardTitle>
                <CardDescription>{e.entry_date} · {e.source}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {e.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.account_code} · {l.account_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.debit ? kes(l.debit) : ""}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.credit ? kes(l.credit) : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && <EmptyNote>No journal entries posted yet.</EmptyNote>}
      </div>
    </div>
  );
}

function TrialBalanceTab() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.getTrialBalance(token, user.school_id).then(setRows).finally(() => setLoading(false));
  }, [token, user?.school_id]);

  if (loading) return <PageLoader />;
  const totalDebit = rows.reduce((a, r) => a + r.debit, 0);
  const totalCredit = rows.reduce((a, r) => a + r.credit, 0);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.account_code}>
                <TableCell className="font-mono">{r.account_code}</TableCell>
                <TableCell>{r.account_name}</TableCell>
                <TableCell className="text-right tabular-nums">{r.debit ? kes(r.debit) : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{r.credit ? kes(r.credit) : ""}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="text-right tabular-nums">{kes(totalDebit)}</TableCell>
              <TableCell className="text-right tabular-nums">{kes(totalCredit)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function IncomeStatementTab() {
  const { token, user } = useAuth();
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.getIncomeStatement(token, user.school_id).then(setData).catch(() => { toast.error("Failed to load the income statement"); setFailed(true); });
  }, [token, user?.school_id]);

  if (failed) return <p className="text-sm text-muted-foreground">Couldn&apos;t load the income statement.</p>;
  if (!data) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Income</p><p className="font-heading text-2xl font-semibold tabular-nums">{kes(data.income_total)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Expenses</p><p className="font-heading text-2xl font-semibold tabular-nums">{kes(data.expense_total)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Surplus</p><p className={`font-heading text-2xl font-semibold tabular-nums ${data.surplus >= 0 ? "text-emerald-600" : "text-destructive"}`}>{kes(data.surplus)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Income</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table><TableBody>
            {data.income_lines.map((l) => (
              <TableRow key={l.account_code}><TableCell>{l.account_name}</TableCell><TableCell className="text-right tabular-nums">{kes(l.credit - l.debit)}</TableCell></TableRow>
            ))}
          </TableBody></Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Expenses</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table><TableBody>
            {data.expense_lines.map((l) => (
              <TableRow key={l.account_code}><TableCell>{l.account_name}</TableCell><TableCell className="text-right tabular-nums">{kes(l.debit - l.credit)}</TableCell></TableRow>
            ))}
          </TableBody></Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BalanceSheetTab() {
  const { token, user } = useAuth();
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.getBalanceSheet(token, user.school_id).then(setData).catch(() => { toast.error("Failed to load the balance sheet"); setFailed(true); });
  }, [token, user?.school_id]);

  if (failed) return <p className="text-sm text-muted-foreground">Couldn&apos;t load the balance sheet.</p>;
  if (!data) return <PageLoader />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Assets</CardTitle><CardDescription>{kes(data.assets_total)}</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table><TableBody>
            {data.asset_lines.map((l) => <TableRow key={l.account_code}><TableCell>{l.account_name}</TableCell><TableCell className="text-right tabular-nums">{kes(l.debit - l.credit)}</TableCell></TableRow>)}
          </TableBody></Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Liabilities &amp; equity</CardTitle><CardDescription>{kes(data.liabilities_total + data.equity_total)}</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table><TableBody>
            {data.liability_lines.map((l) => <TableRow key={l.account_code}><TableCell>{l.account_name}</TableCell><TableCell className="text-right tabular-nums">{kes(l.credit - l.debit)}</TableCell></TableRow>)}
            {data.equity_lines.map((l) => <TableRow key={l.account_code}><TableCell>{l.account_name}</TableCell><TableCell className="text-right tabular-nums">{kes(l.credit - l.debit)}</TableCell></TableRow>)}
            <TableRow><TableCell>Surplus for the period</TableCell><TableCell className="text-right tabular-nums">{kes(data.period_surplus)}</TableCell></TableRow>
          </TableBody></Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LedgerPage() {
  const { user, loading } = useAuth();
  const urlTab = useModuleTab("ledger");   // set only for staff whose sections live in the sidebar
  if (loading) return <PageLoader />;
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ledger" description="Chart of accounts, journal entries, trial balance and financial statements." />
      <Tabs {...(urlTab ? { value: urlTab } : { defaultValue: "is" })}>
        <TabsList className={urlTab ? "hidden" : undefined}>
          <TabsTrigger value="is">Income statement</TabsTrigger>
          <TabsTrigger value="bs">Balance sheet</TabsTrigger>
          <TabsTrigger value="tb">Trial balance</TabsTrigger>
          <TabsTrigger value="jr">Journal</TabsTrigger>
          <TabsTrigger value="coa">Chart of accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="is"><IncomeStatementTab /></TabsContent>
        <TabsContent value="bs"><BalanceSheetTab /></TabsContent>
        <TabsContent value="tb"><TrialBalanceTab /></TabsContent>
        <TabsContent value="jr"><JournalTab /></TabsContent>
        <TabsContent value="coa"><ChartOfAccountsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
