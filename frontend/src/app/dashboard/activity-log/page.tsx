"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, AuditLogEntry } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function describe(entry: AuditLogEntry): string {
  if (entry.action === "result.update" || entry.action === "result.create") {
    const before = entry.before?.score;
    const after = entry.after?.score;
    return before !== undefined ? `Score changed ${before} → ${after}` : `Score recorded: ${after}`;
  }
  if (entry.action === "attendance.update") {
    return `Status changed ${entry.before?.status} → ${entry.after?.status}`;
  }
  if (entry.action === "fee_invoice.create") {
    return `Invoice created: KES ${entry.after?.amount_due} (${entry.after?.term})`;
  }
  if (entry.action === "fee_payment.create") {
    return `Payment recorded: KES ${entry.after?.amount} via ${entry.after?.method}`;
  }
  return entry.action;
}

export default function ActivityLogPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listAuditLog(token, user.school_id).then(setEntries).finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Activity Log" description="Every grade, attendance, and fee change — who, what, and when." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activity Log" description="Every grade, attendance, and fee change — who, what, and when." />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{e.actor_name ?? "System"}</TableCell>
                <TableCell><Badge variant="secondary">{e.entity_type}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{describe(e)}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No activity recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
