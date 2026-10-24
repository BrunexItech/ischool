"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError, GradeLevel, LevelGroup } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LEVEL_LABELS: Record<LevelGroup, string> = {
  pre_primary: "Pre-Primary",
  primary: "Primary School",
  junior_school: "Junior School",
  senior_school: "Senior School",
};

export default function SchoolGradesPage() {
  const router = useRouter();
  const { user, token, loading, schoolOptions } = useAuth();
  const [allGrades, setAllGrades] = useState<GradeLevel[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [enabledIds, setEnabledIds] = useState<Set<number>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "group_principal" && user.role !== "super_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.listGradeLevels(token).then(setAllGrades).catch(() => setAllGrades([])).finally(() => setDataLoading(false));
  }, [token]);

  const effectiveSchoolId = selectedSchoolId || (schoolOptions[0] ? String(schoolOptions[0].id) : "");

  useEffect(() => {
    if (!token || !effectiveSchoolId) return;
    api.listEnabledGrades(token, Number(effectiveSchoolId)).then((grades) => setEnabledIds(new Set(grades.map((g) => g.id))));
  }, [token, effectiveSchoolId]);

  const grouped = useMemo(() => {
    const groups: Record<string, GradeLevel[]> = {};
    for (const g of allGrades) {
      groups[g.level_group] = groups[g.level_group] ?? [];
      groups[g.level_group].push(g);
    }
    return groups;
  }, [allGrades]);

  function toggle(grade: GradeLevel) {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(grade.id)) {
        // Disabling a grade also disables everything above it, keeping the run unbroken.
        for (const g of allGrades) if (g.sort_order >= grade.sort_order) next.delete(g.id);
      } else {
        // Enabling a grade also enables everything below it.
        for (const g of allGrades) if (g.sort_order <= grade.sort_order) next.add(g.id);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!token || !effectiveSchoolId) return;
    setSaving(true);
    try {
      await api.setEnabledGrades(token, Number(effectiveSchoolId), Array.from(enabledIds));
      toast.success("Grade configuration saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="School Grades" description="Choose which education levels and grades each school offers." />

      <div className="flex items-center gap-3">
        <Select value={effectiveSchoolId} onValueChange={(v) => v && setSelectedSchoolId(v)}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Choose a school" /></SelectTrigger>
          <SelectContent>
            {schoolOptions.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{enabledIds.size} grade{enabledIds.size === 1 ? "" : "s"} enabled</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(LEVEL_LABELS) as LevelGroup[]).map((group) => (
          <Card key={group}>
            <CardHeader><CardTitle className="text-base">{LEVEL_LABELS[group]}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(grouped[group] ?? []).map((g) => {
                const on = enabledIds.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g)}
                    className={
                      on
                        ? "rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                        : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40"
                    }
                  >
                    {g.display_name}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving || !effectiveSchoolId} className="w-fit">
        {saving && <Spinner size={16} className="text-current" />} {saving ? "Saving..." : "Save configuration"}
      </Button>
    </div>
  );
}
