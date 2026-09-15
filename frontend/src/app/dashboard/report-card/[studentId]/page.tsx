"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Printer } from "lucide-react";
import { api, AcademicTerm, ReportCard, Result } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STAFF_ROLES = ["school_admin", "teacher", "staff", "super_admin"];

export default function ReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [terms, setTerms] = useState<string[]>([]);
  const [term, setTerm] = useState("");
  const [card, setCard] = useState<ReportCard | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    if (isStaff && user?.school_id) {
      api
        .listAcademicTerms(token, user.school_id)
        .then((ts: AcademicTerm[]) => {
          setTerms(ts.map((t) => t.name));
          const current = ts.find((t) => t.is_current);
          setTerm(current?.name ?? ts[0]?.name ?? "");
        })
        .finally(() => setDataLoading(false));
    } else if (!isStaff) {
      api
        .getChildResults(token, Number(studentId))
        .then((results: Result[]) => {
          const uniqueTerms = Array.from(new Set(results.map((r) => r.term)));
          setTerms(uniqueTerms);
          setTerm(uniqueTerms[0] ?? "");
        })
        .finally(() => setDataLoading(false));
    }
  }, [token, isStaff, user?.school_id, studentId]);

  useEffect(() => {
    if (!token || !term) return;
    const fetcher = isStaff && user?.school_id
      ? api.getReportCard(token, user.school_id, Number(studentId), term)
      : api.getChildReportCard(token, Number(studentId), term);
    fetcher.then(setCard).catch(() => setCard(null));
  }, [token, term, isStaff, user?.school_id, studentId]);

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Select value={term} onValueChange={(v) => v && setTerm(v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Choose a term" /></SelectTrigger>
          <SelectContent>
            {terms.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => window.print()} disabled={!card}><Printer /> Print</Button>
      </div>

      {!card && <p className="text-center text-sm text-muted-foreground">No results recorded for this term yet.</p>}

      {card && (
        <Card className="print:border-none print:shadow-none">
          <CardContent className="flex flex-col gap-6 pt-6">
            <div className="flex flex-col items-center gap-2 border-b pb-4 text-center">
              {card.school_logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.school_logo_url} alt={card.school_name} className="size-14 rounded-full object-cover" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full" style={{ backgroundColor: card.school_primary_color }}>
                  <GraduationCap className="size-7 text-white" />
                </div>
              )}
              <h1 className="text-lg font-semibold">{card.school_name}</h1>
              <p className="text-sm font-medium text-muted-foreground">Official Report Card — {card.term}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">Student</p><p className="font-medium">{card.student_name}</p></div>
              <div><p className="text-muted-foreground">Admission #</p><p className="font-medium">{card.admission_number}</p></div>
              <div><p className="text-muted-foreground">Class</p><p className="font-medium">{card.class_name ?? "—"}</p></div>
              <div><p className="text-muted-foreground">Term</p><p className="font-medium">{card.term}</p></div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {card.rows.map((r) => (
                  <TableRow key={r.subject_name}>
                    <TableCell className="font-medium">{r.subject_name}</TableCell>
                    <TableCell>{r.score}</TableCell>
                    <TableCell>{r.grade ?? "—"}</TableCell>
                    <TableCell>{r.remarks ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">Overall average</span>
              <span className="text-lg font-semibold">{card.average} ({card.overall_grade})</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
