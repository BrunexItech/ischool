"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CommunicationConfig {
  sms_configured: boolean;
  mobilesasa_sender_id: string | null;
  balance: number | null;
}

export default function CommunicationSettingsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [status, setStatus] = useState<CommunicationConfig | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [form, setForm] = useState({ mobilesasa_api_token: "", mobilesasa_sender_id: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.getCommunicationConfig(token, user.school_id).then(setStatus).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const updated = await api.setCommunicationConfig(token, user.school_id, form);
      setStatus(updated);
      setForm({ mobilesasa_api_token: "", mobilesasa_sender_id: "" });
      toast.success("SMS settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save SMS settings");
    } finally {
      setSubmitting(false);
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Communication Settings" description="Connect your school's own bulk SMS account." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Communication Settings" description="Connect your school's own bulk SMS account." />

      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
          <MessageSquare className="size-4.5 shrink-0" />
          SMS sends from <strong>your school&apos;s own</strong> MobileSasa account and is paid for out of your
          own SMS credit — iSchool never holds or touches it. Once connected, you can optionally send an SMS
          alongside any announcement.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bulk SMS (MobileSasa)</CardTitle>
            {status?.sms_configured ? (
              <Badge className="gap-1">
                <CheckCircle2 className="size-3.5" /> Connected — {status.mobilesasa_sender_id}
                {status.balance !== null && ` (${status.balance.toLocaleString()} credits)`}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="size-3.5" /> Not connected</Badge>
            )}
          </div>
          <CardDescription>
            {status?.sms_configured
              ? "Saving a new token below will replace the current connection."
              : "Enter your MobileSasa API token and approved sender ID from mobilesasa.com."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Sender ID</Label>
              <Input
                required
                placeholder="e.g. GREENWOOD"
                value={form.mobilesasa_sender_id}
                onChange={(e) => setForm((f) => ({ ...f, mobilesasa_sender_id: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>API Token</Label>
              <Input
                required
                type="password"
                value={form.mobilesasa_api_token}
                onChange={(e) => setForm((f) => ({ ...f, mobilesasa_api_token: e.target.value }))}
              />
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Saving..." : "Save SMS settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
