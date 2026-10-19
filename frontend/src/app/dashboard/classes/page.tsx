"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, SchoolClass, Staff } from "@/lib/api";
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
import { Plus, ArrowUpRight, Phone, Search } from "lucide-react";

const GRADUATE = "graduate";
const NO_TEACHER = "none";

function ClassTeacherCell({
  schoolClass,
  teachers,
  onUpdated,
}: {
  schoolClass: SchoolClass;
  teachers: Staff[];
  onUpdated: (c: SchoolClass) => void;
}) {
  const { token, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const current = teachers.find((t) => t.user_id === schoolClass.homeroom_teacher_id);

  async function handleChange(value: string) {
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      const updated = await api.updateClass(token, user.school_id, schoolClass.id, {
        homeroom_teacher_id: value === NO_TEACHER ? null : Number(value),
      });
      onUpdated(updated);
      toast.success(value === NO_TEACHER ? "Class teacher removed" : "Class teacher assigned");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update class teacher");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        items={{ [NO_TEACHER]: "Not assigned", ...Object.fromEntries(teachers.map((t) => [String(t.user_id), t.full_name])) }}
        disabled={saving}
        value={schoolClass.homeroom_teacher_id ? String(schoolClass.homeroom_teacher_id) : NO_TEACHER}
        onValueChange={(v) => v && handleChange(v)}
      >
        <SelectTrigger className="w-48"><SelectValue placeholder="Not assigned" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_TEACHER}>Not assigned</SelectItem>
          {teachers.map((t) => <SelectItem key={t.user_id} value={String(t.user_id)}>{t.full_name}</SelectItem>)}
        </SelectContent>
      </Select>
      {current?.phone && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" /> {current.phone}</p>}
    </div>
  );
}

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
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const canManage = user?.role === "school_admin" || user?.role === "super_admin" || user?.role === "supervisor";

  function refreshClasses() {
    if (!token || !user?.school_id) return;
    api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([])).finally(() => setLoading(false));
  }

  useEffect(refreshClasses, [token, user?.school_id]);

  useEffect(() => {
    if (!token || !user?.school_id || !canManage) return;
    api.listStaff(token, user.school_id).then((s) => setTeachers(s.filter((x) => x.role === "teacher"))).catch(() => setTeachers([]));
  }, [token, user?.school_id, canManage]);

  function handleClassUpdated(updated: SchoolClass) {
    setClasses((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
  }

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => {
      const teacherName = teachers.find((t) => t.user_id === c.homeroom_teacher_id)?.full_name ?? "";
      return (
        c.name.toLowerCase().includes(q) ||
        (c.grade_level ?? "").toLowerCase().includes(q) ||
        teacherName.toLowerCase().includes(q)
      );
    });
  }, [classes, teachers, search]);

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

      {classes.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by class, grade, or class teacher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Grade level</TableHead>
              {canManage && <TableHead>Class teacher</TableHead>}
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClasses.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.grade_level ?? "—"}</TableCell>
                {canManage && (
                  <TableCell>
                    <ClassTeacherCell schoolClass={c} teachers={teachers} onUpdated={handleClassUpdated} />
                  </TableCell>
                )}
                {canManage && (
                  <TableCell className="text-right">
                    <PromoteDialog schoolClass={c} allClasses={classes} onPromoted={refreshClasses} />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {classes.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 2} className="h-24 text-center text-muted-foreground">
                  No classes yet.
                </TableCell>
              </TableRow>
            )}
            {classes.length > 0 && filteredClasses.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 2} className="h-24 text-center text-muted-foreground">
                  No classes match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
