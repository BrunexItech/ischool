"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, TrendingUp, Trophy } from "lucide-react";
import { api, AcademicTerm, ResultsAnalytics } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_TERMS = "__all__";

function Bar({ label, value, max, suffix = "" }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}{suffix}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(ALL_TERMS);
  const [data, setData] = useState<ResultsAnalytics | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && !["school_admin", "teacher", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listAcademicTerms(token, user.school_id).then(setTerms).catch(() => setTerms([]));
  }, [token, user?.school_id]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api
      .getResultsAnalytics(token, user.school_id, selectedTerm === ALL_TERMS ? undefined : selectedTerm)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setDataLoading(false));
  }, [token, user?.school_id, selectedTerm]);

  if (loading || dataLoading) return <PageLoader />;

  const maxSubject = Math.max(100, ...(data?.subject_averages.map((s) => s.average) ?? [0]));
  const maxClass = Math.max(100, ...(data?.class_averages.map((c) => c.average) ?? [0]));
  const maxTrend = Math.max(100, ...(data?.term_trend.map((t) => t.average) ?? [0]));
  const maxGrade = Math.max(1, ...(data?.grade_distribution.map((g) => g.count) ?? [0]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Results Analytics" description="Averages, trends, and top performers across the school." />

      <div className="flex items-center gap-3">
        <Select value={selectedTerm} onValueChange={(v) => v && setSelectedTerm(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TERMS}>All terms</SelectItem>
            {terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><BarChart3 className="size-4.5" /></div>
            <div>
              <p className="text-2xl font-semibold">{data?.overall_average ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Overall average</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><TrendingUp className="size-4.5" /></div>
            <div>
              <p className="text-2xl font-semibold">{data?.result_count ?? 0}</p>
              <p className="text-xs text-muted-foreground">Results recorded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Trophy className="size-4.5" /></div>
            <div>
              <p className="text-2xl font-semibold">{data?.subject_averages.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Subjects with results</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Average by subject</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data?.subject_averages.map((s) => <Bar key={s.subject} label={s.subject} value={s.average} max={maxSubject} />)}
            {(!data || data.subject_averages.length === 0) && <p className="text-sm text-muted-foreground">No results yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Average by class</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data?.class_averages.map((c) => <Bar key={c.class_name} label={c.class_name} value={c.average} max={maxClass} />)}
            {(!data || data.class_averages.length === 0) && <p className="text-sm text-muted-foreground">No results yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Grade distribution</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data?.grade_distribution.map((g) => <Bar key={g.grade} label={g.grade} value={g.count} max={maxGrade} suffix=" results" />)}
            {(!data || data.grade_distribution.length === 0) && <p className="text-sm text-muted-foreground">No grades recorded yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Trend across terms</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data?.term_trend.map((t) => <Bar key={t.term} label={t.term} value={t.average} max={maxTrend} />)}
            {(!data || data.term_trend.length === 0) && <p className="text-sm text-muted-foreground">No results yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top performers</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data?.top_students.map((s, i) => (
            <div key={s.student_name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Badge variant="secondary">{i + 1}</Badge> {s.student_name}</span>
              <span className="font-medium">{s.average}</span>
            </div>
          ))}
          {(!data || data.top_students.length === 0) && <p className="text-sm text-muted-foreground">No results yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
