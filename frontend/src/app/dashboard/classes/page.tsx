"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

export default function ClassesPage() {
  const { user, token } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === "school_admin" || user?.role === "super_admin";

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([]));
  }, [token, user?.school_id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.createClass(token, user.school_id, {
        name,
        grade_level: gradeLevel || undefined,
      });
      setClasses((c) => [...c, created]);
      setName("");
      setGradeLevel("");
      toast.success(`${created.name} added`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create class");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Classes" description="Manage the classes and grade levels at your school." />

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a class</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="class-name">Class name</Label>
                <Input id="class-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Form 1A" className="w-48" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="grade-level">Grade level</Label>
                <Input id="grade-level" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="Form 1" className="w-48" />
              </div>
              <Button disabled={submitting} type="submit">
                <Plus /> {submitting ? "Adding..." : "Add class"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Grade level</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.grade_level ?? "—"}</TableCell>
              </TableRow>
            ))}
            {classes.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                  No classes yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
