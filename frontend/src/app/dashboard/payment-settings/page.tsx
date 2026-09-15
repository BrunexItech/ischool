"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Smartphone } from "lucide-react";
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
  const [form, setForm] = useState({
    mpesa_shortcode: "",
    mpesa_consumer_key: "",
    mpesa_consumer_secret: "",
    mpesa_passkey: "",
    mpesa_env: "sandbox" as "sandbox" | "production",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.getPaymentConfig(token, user.school_id).then(setStatus).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const updated = await api.setPaymentConfig(token, user.school_id, form);
      setStatus(updated);
      setForm({ mpesa_shortcode: "", mpesa_consumer_key: "", mpesa_consumer_secret: "", mpesa_passkey: "", mpesa_env: "sandbox" });
      toast.success("M-Pesa payment settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save payment settings");
    } finally {
      setSubmitting(false);
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Payment Settings" description="Connect your school's own M-Pesa paybill so parents can pay fees directly." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payment Settings" description="Connect your school's own M-Pesa paybill so parents can pay fees directly." />

      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
          <Smartphone className="size-4.5 shrink-0" />
          Money goes straight from a parent&apos;s phone into <strong>your school&apos;s own</strong> M-Pesa paybill —
          iSchool never holds or touches the funds. You&apos;ll need your Safaricom Daraja app credentials from{" "}
          <a href="https://developer.safaricom.co.ke" target="_blank" rel="noreferrer" className="text-primary hover:underline">
            developer.safaricom.co.ke
          </a>.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">M-Pesa (Safaricom Daraja)</CardTitle>
            {status?.is_configured ? (
              <Badge className="gap-1"><CheckCircle2 className="size-3.5" /> Connected — {status.mpesa_shortcode} ({status.mpesa_env})</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="size-3.5" /> Not connected</Badge>
            )}
          </div>
          <CardDescription>
            {status?.is_configured
              ? "Saving new credentials below will replace the current connection."
              : "Enter your paybill/till number and Daraja app credentials."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Paybill / Till number</Label>
              <Input required value={form.mpesa_shortcode} onChange={(e) => setForm((f) => ({ ...f, mpesa_shortcode: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Environment</Label>
              <Select value={form.mpesa_env} onValueChange={(v) => v && setForm((f) => ({ ...f, mpesa_env: v as "sandbox" | "production" }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
                  <SelectItem value="production">Production (live)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Consumer Key</Label>
              <Input required value={form.mpesa_consumer_key} onChange={(e) => setForm((f) => ({ ...f, mpesa_consumer_key: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Consumer Secret</Label>
              <Input required type="password" value={form.mpesa_consumer_secret} onChange={(e) => setForm((f) => ({ ...f, mpesa_consumer_secret: e.target.value }))} />
            </div>
            <div className="col-span-full grid gap-1.5">
              <Label>Passkey</Label>
              <Input required type="password" value={form.mpesa_passkey} onChange={(e) => setForm((f) => ({ ...f, mpesa_passkey: e.target.value }))} />
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Save M-Pesa settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
