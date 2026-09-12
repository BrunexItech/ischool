"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, AcademicTerm, ApiError, FeeInvoice, FeeInvoiceDetail, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Receipt } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  partial: "secondary",
  unpaid: "destructive",
};

function PaymentForm({ invoiceId, onRecorded }: { invoiceId: number; onRecorded: (detail: FeeInvoiceDetail) => void }) {
  const { token, user } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mpesa");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const detail = await api.recordPayment(token, user.school_id, invoiceId, {
        amount: Number(amount),
        method,
        reference: reference || undefined,
      });
      onRecorded(detail);
      setAmount("");
      setReference("");
      toast.success("Payment recorded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1.5">
        <Label className="text-xs">Amount</Label>
        <Input required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Method</Label>
        <Select value={method} onValueChange={(v) => v && setMethod(v)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mpesa">M-Pesa</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Reference</Label>
        <Input value={reference} onChange={(e) => setReference(e.target.value)} className="w-36" placeholder="Optional" />
      </div>
      <Button disabled={submitting} type="submit" size="sm">
        {submitting ? "Recording..." : "Record payment"}
      </Button>
    </form>
  );
}

function InvoiceDialog({ invoice, studentLabel, onUpdated }: { invoice: FeeInvoice; studentLabel: string; onUpdated: (d: FeeInvoiceDetail) => void }) {
  const { token, user } = useAuth();
  const [detail, setDetail] = useState<FeeInvoiceDetail | null>(null);
  const [open, setOpen] = useState(false);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && token && user?.school_id) {
      setDetail(await api.getInvoice(token, user.school_id, invoice.id));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm"><Receipt /> Details</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{studentLabel} · {invoice.term}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-muted-foreground">Due</p><p className="font-medium">KES {invoice.amount_due.toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Paid</p><p className="font-medium">KES {invoice.amount_paid.toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Balance</p><p className="font-medium">KES {invoice.balance.toLocaleString()}</p></div>
        </div>
        <Separator />
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Payment history</p>
          <ul className="space-y-1 text-sm">
            {(detail?.payments ?? []).map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>KES {p.amount.toLocaleString()} · {p.method}{p.reference ? ` (${p.reference})` : ""}</span>
                <span className="text-muted-foreground">{new Date(p.paid_at).toLocaleDateString()}</span>
              </li>
            ))}
            {detail && detail.payments.length === 0 && <li className="text-muted-foreground">No payments recorded yet.</li>}
          </ul>
        </div>
        <Separator />
        <PaymentForm invoiceId={invoice.id} onRecorded={(d) => { setDetail(d); onUpdated(d); }} />
      </DialogContent>
    </Dialog>
  );
}

export default function FeesPage() {
  const { user, token } = useAuth();
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [form, setForm] = useState({ student_id: "", term: "", amount_due: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listInvoices(token, user.school_id).then(setInvoices);
    api.listStudents(token, user.school_id).then(setStudents);
    api.listAcademicTerms(token, user.school_id).then((ts) => {
      setTerms(ts);
      const current = ts.find((t) => t.is_current) ?? ts[0];
      if (current) setForm((f) => ({ ...f, term: current.name }));
    });
  }, [token, user?.school_id]);

  function studentLabel(studentId: number) {
    const s = students.find((st) => st.id === studentId);
    return s ? `${s.first_name} ${s.last_name} (${s.admission_number})` : `#${studentId}`;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const invoice = await api.createInvoice(token, user.school_id, {
        student_id: Number(form.student_id),
        term: form.term,
        amount_due: Number(form.amount_due),
      });
      setInvoices((inv) => [...inv, invoice]);
      setForm({ student_id: "", term: form.term, amount_due: "" });
      toast.success("Invoice created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fees" description="Create invoices and track payments by term." />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Student</Label>
              <Select required value={form.student_id} onValueChange={(v) => setForm((f) => ({ ...f, student_id: v ?? "" }))}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name} ({s.admission_number})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Term</Label>
              {terms.length > 0 ? (
                <Select required value={form.term} onValueChange={(v) => v && setForm((f) => ({ ...f, term: v }))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input required value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} placeholder="Add a term first" className="w-40" />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Amount due (KES)</Label>
              <Input required type="number" min={1} value={form.amount_due} onChange={(e) => setForm((f) => ({ ...f, amount_due: e.target.value }))} className="w-36" />
            </div>
            <Button disabled={submitting} type="submit">
              <Plus /> {submitting ? "Creating..." : "Create invoice"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{studentLabel(inv.student_id)}</TableCell>
                <TableCell className="text-muted-foreground">{inv.term}</TableCell>
                <TableCell>KES {inv.balance.toLocaleString()}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[inv.status]} className="capitalize">{inv.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <InvoiceDialog
                    invoice={inv}
                    studentLabel={studentLabel(inv.student_id)}
                    onUpdated={(updated) => setInvoices((all) => all.map((i) => (i.id === updated.id ? updated : i)))}
                  />
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
