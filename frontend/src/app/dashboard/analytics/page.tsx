"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, TrendingUp, Trophy } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, AcademicTerm, AttendanceTrendPoint, FinanceSummary, ResultsAnalytics } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_TERMS = "__all__";

const GRADE_COLOR: Record<string, string> = {
  A: "#10b981",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#f97316",
  E: "#ef4444",
};

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };
const axisProps = { axisLine: false, tickLine: false, fontSize: 12, stroke: "var(--muted-foreground)" };

function ChartCard({ title, description, empty, children }: { title: string; description: string; empty: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p> : children}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const canSeeFinance = user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "bursar" || user?.role === "group_principal";
  const financeOnly = user?.role === "bursar";

  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(ALL_TERMS);
  const [results, setResults] = useState<ResultsAnalytics | null>(null);
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrendPoint[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "teacher", "staff", "super_admin", "bursar", "group_principal"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listAcademicTerms(token, user.school_id).then(setTerms).catch(() => setTerms([]));
    api.getAttendanceTrend(token, user.school_id).then(setAttendanceTrend).catch(() => setAttendanceTrend([]));
    if (canSeeFinance) api.getFinanceSummary(token, user.school_id).then(setFinance).catch(() => setFinance(null));
  }, [token, user?.school_id, canSeeFinance]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api
      .getResultsAnalytics(token, user.school_id, selectedTerm === ALL_TERMS ? undefined : selectedTerm)
      .then(setResults)
      .catch(() => setResults(null))
      .finally(() => setDataLoading(false));
  }, [token, user?.school_id, selectedTerm]);

  if (loading || dataLoading) return <PageLoader />;

  const attendanceData = attendanceTrend.map((p) => ({
    label: new Date(p.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" }),
    rate: p.rate,
    isToday: p.date === new Date().toISOString().slice(0, 10),
  }));

  const financeData = (finance?.monthly ?? []).map((m) => ({ month: m.month, Income: m.income, Expenses: m.expenses }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description={financeOnly ? "Real numbers from your own data — income and expense trends." : "Real numbers from your own data — results, attendance, and finance trends."}
      />

      {!financeOnly && (
      <div className="flex items-center gap-3">
        <Select value={selectedTerm} onValueChange={(v) => v && setSelectedTerm(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TERMS}>All terms</SelectItem>
            {terms.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      )}

      {!financeOnly && (
      <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><BarChart3 className="size-4.5" /></div>
            <div>
              <p className="text-2xl font-semibold">{results?.overall_average ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Overall average</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><TrendingUp className="size-4.5" /></div>
            <div>
              <p className="text-2xl font-semibold">{results?.result_count ?? 0}</p>
              <p className="text-xs text-muted-foreground">Results recorded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Trophy className="size-4.5" /></div>
            <div>
              <p className="text-2xl font-semibold">{results?.subject_averages.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Subjects with results</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Average by subject" description="Mean score per subject" empty={!results?.subject_averages.length}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={results?.subject_averages} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="subject" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Average"]} />
              <Bar dataKey="average" radius={[4, 4, 0, 0]} fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Average by class" description="Mean score per class" empty={!results?.class_averages.length}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={results?.class_averages} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="class_name" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Average"]} />
              <Bar dataKey="average" radius={[4, 4, 0, 0]} fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Grade distribution" description="Count of results by grade" empty={!results?.grade_distribution.length}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={results?.grade_distribution} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="grade" {...axisProps} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Results"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {results?.grade_distribution.map((g) => <Cell key={g.grade} fill={GRADE_COLOR[g.grade] ?? "var(--primary)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Trend across terms" description="Overall average, term over term" empty={!results?.term_trend.length}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={results?.term_trend} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="term" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}`, "Average"]} />
              <Line type="monotone" dataKey="average" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {!financeOnly && (
        <ChartCard title="Attendance" description="Share of learners present or late, last 7 days" empty={!attendanceData.length}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceData} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                contentStyle={tooltipStyle}
                formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)}%` : "Not marked", "Attendance"]}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {attendanceData.map((d, i) => <Cell key={i} fill={d.isToday ? "var(--primary)" : "var(--chart-2)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        )}

        {canSeeFinance && (
          <ChartCard title="Income vs. expenses" description="By month, from recorded fees and approved expenses" empty={!financeData.length}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={financeData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`KES ${Number(v).toLocaleString()}`, undefined]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {!financeOnly && (
      <Card>
        <CardHeader><CardTitle className="text-base">Top performers</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {results?.top_students.map((s, i) => (
            <div key={s.student_name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Badge variant="secondary">{i + 1}</Badge> {s.student_name}</span>
              <span className="font-medium">{s.average}</span>
            </div>
          ))}
          {(!results || results.top_students.length === 0) && <p className="text-sm text-muted-foreground">No results yet.</p>}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
