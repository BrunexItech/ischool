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

type Outcome = "verifying" | "success" | "failed" | "invalid";

const MAX_POLLS = 5;
const POLL_INTERVAL_MS = 2500;

function PayCallbackBody() {
  const { token, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [outcome, setOutcome] = useState<Outcome>("verifying");
  const [attempt, setAttempt] = useState(0);

  const studentId = searchParams.get("student_id");
  const invoiceId = searchParams.get("invoice_id");
  const localTransactionId = searchParams.get("local_transaction_id");

  const immediateOutcome: Outcome | null = !studentId || !invoiceId || !localTransactionId ? "invalid" : null;

  useEffect(() => {
    if (authLoading || immediateOutcome || !token || attempt >= MAX_POLLS) return;

    const timer = setTimeout(
      () => {
        api
          .checkCardPaymentStatus(token, Number(studentId), Number(invoiceId), Number(localTransactionId))
          .then((tx) => {
            if (tx.status === "pending") {
              setAttempt((a) => a + 1);
            } else {
              setOutcome(tx.status === "completed" ? "success" : "failed");
            }
          })
          .catch((err) => setOutcome(err instanceof ApiError ? "failed" : "invalid"));
      },
      attempt === 0 ? 0 : POLL_INTERVAL_MS
    );

    return () => clearTimeout(timer);
  }, [authLoading, immediateOutcome, token, studentId, invoiceId, localTransactionId, attempt]);

  const displayOutcome = immediateOutcome ?? (attempt >= MAX_POLLS && outcome === "verifying" ? "failed" : outcome);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle>Card payment</CardTitle>
        <CardDescription>
          {displayOutcome === "verifying" && "Confirming your payment..."}
          {displayOutcome === "success" && "Payment received — thank you!"}
          {displayOutcome === "failed" && "This payment could not be confirmed. If you completed it, check back shortly."}
          {displayOutcome === "invalid" && "This payment link is invalid or has expired."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 pb-6">
        {displayOutcome === "verifying" && <Spinner size={32} />}
        {displayOutcome === "success" && <CheckCircle2 className="size-10 text-emerald-600" />}
        {(displayOutcome === "failed" || displayOutcome === "invalid") && <XCircle className="size-10 text-destructive" />}
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
