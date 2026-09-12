"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowUpRight } from "lucide-react";

const GRADUATE = "graduate";

function PromoteDialog({ schoolClass, allClasses, onPromoted }: { schoolClass: SchoolClass; allClasses: SchoolClass[]; onPromoted: () => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const otherClasses = allClasses.filter((c) => c.id !== schoolClass.id);

  async function handlePromote() {
    if (!token || !user?.school_id || !target) return;
    setSubmitting(true);
    try {
      const toClassId = target === GRADUATE ? null : Number(target);
      const result = await api.promoteClass(token, user.school_id, schoolClass.id, toClassId);
      toast.success(
        result.graduated
          ? `${result.moved_count} student(s) graduated`
          : `${result.moved_count} student(s) promoted`
      );
      setOpen(false);
      onPromoted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to promote class");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><ArrowUpRight /> Promote</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote {schoolClass.name}</DialogTitle>
          <DialogDescription>
            Moves every active student out of {schoolClass.name}. This can&apos;t be undone in bulk — you&apos;d
            have to move students back one by one.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Move to</Label>
          <Select value={target} onValueChange={(v) => v && setTarget(v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select a class..." /></SelectTrigger>
            <SelectContent>
              {otherClasses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              <SelectItem value={GRADUATE}>Graduate (leaving the school)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handlePromote} disabled={submitting || !target}>
          {submitting ? "Promoting..." : "Confirm promotion"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function ClassesPage() {
  const { user, token } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === "school_admin" || user?.role === "super_admin";

  function refreshClasses() {
    if (!token || !user?.school_id) return;
    api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([])).finally(() => setLoading(false));
  }

  useEffect(refreshClasses, [token, user?.school_id]);

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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Classes" description="Manage the classes and grade levels at your school." />
        <PageLoader />
      </div>
    );
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
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.grade_level ?? "—"}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <PromoteDialog schoolClass={c} allClasses={classes} onPromoted={refreshClasses} />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {classes.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 3 : 2} className="h-24 text-center text-muted-foreground">
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
