"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Smartphone, CreditCard } from "lucide-react";
import { api, ApiError, PaymentConfigStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PaymentSettingsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [status, setStatus] = useState<PaymentConfigStatus | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [mpesaForm, setMpesaForm] = useState({
    mpesa_shortcode: "",
    mpesa_consumer_key: "",
    mpesa_consumer_secret: "",
    mpesa_passkey: "",
    mpesa_env: "sandbox" as "sandbox" | "production",
  });
  const [mpesaSubmitting, setMpesaSubmitting] = useState(false);

  const [cardForm, setCardForm] = useState({
    pesapal_consumer_key: "",
    pesapal_consumer_secret: "",
    pesapal_env: "sandbox" as "sandbox" | "production",
  });
  const [cardSubmitting, setCardSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.getPaymentConfig(token, user.school_id).then(setStatus).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  async function handleMpesaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setMpesaSubmitting(true);
    try {
      const updated = await api.setPaymentConfig(token, user.school_id, mpesaForm);
      setStatus(updated);
      setMpesaForm({ mpesa_shortcode: "", mpesa_consumer_key: "", mpesa_consumer_secret: "", mpesa_passkey: "", mpesa_env: "sandbox" });
      toast.success("M-Pesa payment settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save M-Pesa settings");
    } finally {
      setMpesaSubmitting(false);
    }
  }

  async function handleCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setCardSubmitting(true);
    try {
      const updated = await api.setPaymentConfig(token, user.school_id, cardForm);
      setStatus(updated);
      setCardForm({ pesapal_consumer_key: "", pesapal_consumer_secret: "", pesapal_env: "sandbox" });
      toast.success("Card payment settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save card settings");
    } finally {
      setCardSubmitting(false);
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Payment Settings" description="Connect your school's own payment providers so parents can pay fees directly." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payment Settings" description="Connect your school's own payment providers so parents can pay fees directly." />

      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
          <Smartphone className="size-4.5 shrink-0" />
          Every payment goes straight into <strong>your school&apos;s own</strong> account — iSchool never holds or
          touches the funds, for M-Pesa or cards. Connect either or both; parents will see only the methods you&apos;ve
          set up. You can disable either at any time by clearing its credentials.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">M-Pesa (Safaricom Daraja)</CardTitle>
            {status?.mpesa_configured ? (
              <Badge className="gap-1"><CheckCircle2 className="size-3.5" /> Connected — {status.mpesa_shortcode} ({status.mpesa_env})</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="size-3.5" /> Not connected</Badge>
            )}
          </div>
          <CardDescription>
            {status?.mpesa_configured
              ? "Saving new credentials below will replace the current connection."
              : "Enter your paybill/till number and Daraja app credentials from developer.safaricom.co.ke."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMpesaSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Paybill / Till number</Label>
              <Input required value={mpesaForm.mpesa_shortcode} onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_shortcode: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Environment</Label>
              <Select value={mpesaForm.mpesa_env} onValueChange={(v) => v && setMpesaForm((f) => ({ ...f, mpesa_env: v as "sandbox" | "production" }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
                  <SelectItem value="production">Production (live)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Consumer Key</Label>
              <Input required value={mpesaForm.mpesa_consumer_key} onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_consumer_key: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Consumer Secret</Label>
              <Input required type="password" value={mpesaForm.mpesa_consumer_secret} onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_consumer_secret: e.target.value }))} />
            </div>
            <div className="col-span-full grid gap-1.5">
              <Label>Passkey</Label>
              <Input required type="password" value={mpesaForm.mpesa_passkey} onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_passkey: e.target.value }))} />
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={mpesaSubmitting}>
                {mpesaSubmitting && <Spinner size={16} className="text-current" />} {mpesaSubmitting ? "Saving..." : "Save M-Pesa settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Card & mobile money (Pesapal)</CardTitle>
            {status?.card_configured ? (
              <Badge className="gap-1"><CheckCircle2 className="size-3.5" /> Connected ({status.pesapal_env})</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="size-3.5" /> Not connected</Badge>
            )}
          </div>
          <CardDescription>
            {status?.card_configured
              ? "Saving new credentials below will replace the current connection."
              : "Enter your Pesapal merchant API credentials from developer.pesapal.com to accept Visa/Mastercard and mobile money."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCardSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Consumer Key</Label>
              <Input required value={cardForm.pesapal_consumer_key} onChange={(e) => setCardForm((f) => ({ ...f, pesapal_consumer_key: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Consumer Secret</Label>
              <Input required type="password" value={cardForm.pesapal_consumer_secret} onChange={(e) => setCardForm((f) => ({ ...f, pesapal_consumer_secret: e.target.value }))} />
            </div>
            <div className="col-span-full grid gap-1.5">
              <Label>Environment</Label>
              <Select value={cardForm.pesapal_env} onValueChange={(v) => v && setCardForm((f) => ({ ...f, pesapal_env: v as "sandbox" | "production" }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
                  <SelectItem value="production">Production (live)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={cardSubmitting}>
                {cardSubmitting && <Spinner size={16} className="text-current" />}
                <CreditCard className="size-4" /> {cardSubmitting ? "Saving..." : "Save card settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
