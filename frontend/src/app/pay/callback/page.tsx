"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";

type Outcome = "verifying" | "success" | "failed" | "cancelled" | "invalid";

function PayCallbackBody() {
  const { token, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [outcome, setOutcome] = useState<Outcome>("verifying");

  const studentId = searchParams.get("student_id");
  const invoiceId = searchParams.get("invoice_id");
  const localTransactionId = searchParams.get("local_transaction_id");
  const flutterwaveStatus = searchParams.get("status");
  const flutterwaveTransactionId = searchParams.get("transaction_id");

  const immediateOutcome: Outcome | null = !studentId || !invoiceId || !localTransactionId
    ? "invalid"
    : flutterwaveStatus === "cancelled"
      ? "cancelled"
      : !flutterwaveTransactionId
        ? "invalid"
        : null;

  useEffect(() => {
    if (authLoading || immediateOutcome || !token) return;

    api
      .verifyCardPayment(token, Number(studentId), Number(invoiceId), Number(localTransactionId), {
        flutterwave_transaction_id: flutterwaveTransactionId as string,
      })
      .then((tx) => setOutcome(tx.status === "completed" ? "success" : "failed"))
      .catch((err) => {
        setOutcome(err instanceof ApiError ? "failed" : "invalid");
      });
  }, [authLoading, immediateOutcome, token, studentId, invoiceId, localTransactionId, flutterwaveTransactionId]);

  const displayOutcome = immediateOutcome ?? outcome;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle>Card payment</CardTitle>
        <CardDescription>
          {displayOutcome === "verifying" && "Confirming your payment..."}
          {displayOutcome === "success" && "Payment received — thank you!"}
          {displayOutcome === "failed" && "This payment could not be confirmed."}
          {displayOutcome === "cancelled" && "You cancelled the payment."}
          {displayOutcome === "invalid" && "This payment link is invalid or has expired."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 pb-6">
        {displayOutcome === "verifying" && <Spinner size={32} />}
        {displayOutcome === "success" && <CheckCircle2 className="size-10 text-emerald-600" />}
        {(displayOutcome === "failed" || displayOutcome === "cancelled" || displayOutcome === "invalid") && (
          <XCircle className="size-10 text-destructive" />
        )}
        {displayOutcome !== "verifying" && <Button render={<Link href="/dashboard">Back to dashboard</Link>} />}
      </CardContent>
    </Card>
  );
}

export default function PayCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Suspense fallback={null}>
        <PayCallbackBody />
      </Suspense>
    </div>
  );
}
