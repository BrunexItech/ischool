"use client";

import { useEffect, useState } from "react";
import { api, AttendanceRecord, FeeInvoice, Result } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export function StudentRecordView({ studentId }: { studentId: number }) {
  const { token } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);

  useEffect(() => {
    if (!token) return;
    api.getChildAttendance(token, studentId).then(setAttendance).catch(() => setAttendance([]));
    api.getChildResults(token, studentId).then(setResults).catch(() => setResults([]));
    api.getChildFees(token, studentId).then(setInvoices).catch(() => setInvoices([]));
  }, [token, studentId]);

  return (
    <Tabs defaultValue="attendance">
      <TabsList>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="fees">Fees</TabsTrigger>
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
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.term}</TableCell>
                  <TableCell>KES {inv.balance.toLocaleString()}</TableCell>
                  <TableCell><Badge variant={FEE_STATUS_VARIANT[inv.status]} className="capitalize">{inv.status}</Badge></TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
