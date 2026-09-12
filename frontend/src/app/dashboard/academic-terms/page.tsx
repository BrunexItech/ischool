"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Plus } from "lucide-react";
import { api, AcademicTerm, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AcademicTermsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listAcademicTerms(token, user.school_id).then(setTerms);
  }, [token, user?.school_id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.createAcademicTerm(token, user.school_id, {
        name: form.name,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      });
      setTerms((t) => [created, ...t]);
      setForm({ name: "", start_date: "", end_date: "" });
      toast.success(`${created.name} added`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create term");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetCurrent(id: number) {
    if (!token || !user?.school_id) return;
    await api.setCurrentAcademicTerm(token, user.school_id, id);
    setTerms((all) => all.map((t) => ({ ...t, is_current: t.id === id })));
    toast.success("Current term updated");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Academic Terms"
        description="The terms your school uses everywhere — results, fees, and reporting all pick from this list."
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Term name</Label>
              <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Term 1 2026" className="w-48" />
            </div>
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="w-44" />
            </div>
            <div className="grid gap-1.5">
              <Label>End date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="w-44" />
            </div>
            <Button type="submit" disabled={submitting}>
              <Plus /> {submitting ? "Adding..." : "Add term"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Term</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {terms.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  {t.name} {t.is_current && <Badge className="ml-2 gap-1"><CheckCircle2 className="size-3.5" /> Current</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.start_date && t.end_date ? `${t.start_date} → ${t.end_date}` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {!t.is_current && (
                    <Button variant="outline" size="sm" onClick={() => handleSetCurrent(t.id)}>
                      Set as current
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {terms.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No terms yet — add your first one above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
