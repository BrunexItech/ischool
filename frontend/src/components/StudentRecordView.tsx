"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Smartphone, XCircle } from "lucide-react";
import { api, ApiError, AttendanceRecord, FeeInvoice, PaymentTransaction, Result, StudentTransport } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ATTENDANCE_STYLE: Record<string, string> = {
  present: "text-emerald-600",
  absent: "text-red-600",
  late: "text-amber-600",
  excused: "text-sky-600",
};

const FEE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  partial: "secondary",
  unpaid: "destructive",
};

function PayWithMpesaDialog({ studentId, invoice, onPaid }: { studentId: number; invoice: FeeInvoice; onPaid: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => stopPolling, []);

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const tx = await api.payInvoiceWithMpesa(token, studentId, invoice.id, { phone_number: phone });
      setTransaction(tx);
      pollRef.current = setInterval(async () => {
        const updated = await api.checkMpesaPaymentStatus(token, studentId, invoice.id, tx.id);
        setTransaction(updated);
        if (updated.status !== "pending") {
          stopPolling();
          if (updated.status === "completed") {
            toast.success("Payment received — thank you!");
            onPaid();
          }
        }
      }, 3000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to start M-Pesa payment");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      stopPolling();
      setTransaction(null);
      setPhone("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm"><Smartphone /> Pay with M-Pesa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {invoice.term} balance</DialogTitle>
        </DialogHeader>

        {!transaction && (
          <form onSubmit={handleInitiate} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Balance: KES {invoice.balance.toLocaleString()}. You&apos;ll get an M-Pesa prompt on your phone.
            </p>
            <div className="grid gap-1.5">
              <Label>M-Pesa phone number</Label>
              <Input required placeholder="0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Sending prompt..." : "Send M-Pesa prompt"}
            </Button>
          </form>
        )}

        {transaction?.status === "pending" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Spinner size={28} />
            <p className="text-sm text-muted-foreground">Enter your M-Pesa PIN on your phone to complete the payment...</p>
          </div>
        )}
        {transaction?.status === "completed" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="size-8 text-emerald-600" />
            <p className="text-sm font-medium">Payment received</p>
          </div>
        )}
        {transaction?.status === "failed" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">The payment didn&apos;t go through. You can try again.</p>
            <Button variant="outline" size="sm" onClick={() => setTransaction(null)}>Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StudentRecordView({ studentId }: { studentId: number }) {
  const { token } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [transport, setTransport] = useState<StudentTransport | null>(null);
  const [loading, setLoading] = useState(true);

  function refreshFees() {
    if (!token) return;
    api.getChildFees(token, studentId).then(setInvoices).catch(() => setInvoices([]));
  }

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.getChildAttendance(token, studentId).then(setAttendance).catch(() => setAttendance([])),
      api.getChildResults(token, studentId).then(setResults).catch(() => setResults([])),
      api.getChildFees(token, studentId).then(setInvoices).catch(() => setInvoices([])),
      api.getChildTransport(token, studentId).then(setTransport).catch(() => setTransport(null)),
    ]).finally(() => setLoading(false));
  }, [token, studentId]);

  if (loading) return <PageLoader />;

  return (
    <Tabs defaultValue="attendance">
      <TabsList>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="fees">Fees</TabsTrigger>
        <TabsTrigger value="transport">Transport</TabsTrigger>
      </TabsList>

      <TabsContent value="attendance" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell className={`capitalize ${ATTENDANCE_STYLE[r.status]}`}>{r.status}</TableCell>
                </TableRow>
              ))}
              {attendance.length === 0 && (
                <TableRow><TableCell colSpan={2} className="h-24 text-center text-muted-foreground">No attendance recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="results" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.term}</TableCell>
                  <TableCell>{r.score}</TableCell>
                  <TableCell><Badge variant="secondary">{r.grade}</Badge></TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No results recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="fees" className="mt-4">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.term}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{inv.category}</Badge></TableCell>
                  <TableCell>KES {inv.balance.toLocaleString()}</TableCell>
                  <TableCell><Badge variant={FEE_STATUS_VARIANT[inv.status]} className="capitalize">{inv.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {inv.status !== "paid" && (
                      <PayWithMpesaDialog studentId={studentId} invoice={inv} onPaid={refreshFees} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="transport" className="mt-4">
        <Card>
          <CardContent className="pt-6">
            {transport?.assigned ? (
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div><p className="text-muted-foreground">Route</p><p className="font-medium">{transport.route_name}</p></div>
                <div><p className="text-muted-foreground">Stop</p><p className="font-medium">{transport.stop_name ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Pickup time</p><p className="font-medium">{transport.pickup_time ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Vehicle</p><p className="font-medium">{transport.vehicle_registration ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Driver</p><p className="font-medium">{transport.driver_name ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Driver phone</p><p className="font-medium">{transport.driver_phone ?? "—"}</p></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned to a transport route yet.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
