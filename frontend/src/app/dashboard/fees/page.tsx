"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, FeeInvoice, FeeInvoiceDetail, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  unpaid: "bg-red-100 text-red-700",
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-2">
      <input required type="number" min={1} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm" />
      <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
        <option value="mpesa">M-Pesa</option>
        <option value="cash">Cash</option>
        <option value="bank">Bank</option>
      </select>
      <input placeholder="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
      <button disabled={submitting} type="submit" className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
        {submitting ? "Recording..." : "Record payment"}
      </button>
    </form>
  );
}

export default function FeesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<FeeInvoiceDetail | null>(null);
  const [form, setForm] = useState({ student_id: "", term: "Term 1 2026", amount_due: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listInvoices(token, user.school_id).then(setInvoices);
    api.listStudents(token, user.school_id).then(setStudents);
  }, [token, user?.school_id]);

  function studentLabel(studentId: number) {
    const s = students.find((st) => st.id === studentId);
    return s ? `${s.first_name} ${s.last_name} (${s.admission_number})` : `#${studentId}`;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    setError(null);
    try {
      const invoice = await api.createInvoice(token, user.school_id, {
        student_id: Number(form.student_id),
        term: form.term,
        amount_due: Number(form.amount_due),
      });
      setInvoices((inv) => [...inv, invoice]);
      setForm({ student_id: "", term: form.term, amount_due: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleExpand(invoiceId: number) {
    if (expanded === invoiceId) {
      setExpanded(null);
      return;
    }
    setExpanded(invoiceId);
    if (token && user?.school_id) {
      setDetail(await api.getInvoice(token, user.school_id, invoiceId));
    }
  }

  function handlePaymentRecorded(updated: FeeInvoiceDetail) {
    setDetail(updated);
    setInvoices((inv) => inv.map((i) => (i.id === updated.id ? updated : i)));
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Fees</h1>

        <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Student</label>
            <select required value={form.student_id} onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Term</label>
            <input value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Amount due (KES)</label>
            <input required type="number" min={1} value={form.amount_due} onChange={(e) => setForm((f) => ({ ...f, amount_due: e.target.value }))} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button disabled={submitting} type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {submitting ? "Creating..." : "Create invoice"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <button onClick={() => toggleExpand(inv.id)} className="flex w-full items-center justify-between text-left">
                <div>
                  <p className="font-medium text-gray-900">{studentLabel(inv.student_id)} · {inv.term}</p>
                  <p className="text-sm text-gray-500">
                    Due: KES {inv.amount_due.toLocaleString()} · Paid: KES {inv.amount_paid.toLocaleString()} · Balance: KES {inv.balance.toLocaleString()}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${STATUS_STYLES[inv.status]}`}>
                  {inv.status}
                </span>
              </button>
              {expanded === inv.id && detail && detail.id === inv.id && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-gray-600">Payment history</p>
                  <ul className="mb-2 space-y-1 text-sm text-gray-600">
                    {detail.payments.map((p) => (
                      <li key={p.id}>
                        KES {p.amount.toLocaleString()} via {p.method}{p.reference ? ` (${p.reference})` : ""} — {new Date(p.paid_at).toLocaleDateString()}
                      </li>
                    ))}
                    {detail.payments.length === 0 && <li className="text-gray-400">No payments recorded yet.</li>}
                  </ul>
                  <PaymentForm invoiceId={inv.id} onRecorded={handlePaymentRecorded} />
                </div>
              )}
            </div>
          ))}
          {invoices.length === 0 && <p className="text-sm text-gray-500">No invoices yet.</p>}
        </div>
      </main>
    </div>
  );
}
