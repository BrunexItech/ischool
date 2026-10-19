"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError, MyClass, SchoolClass, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";
import { ArrowLeft, CheckCircle2, GraduationCap, KeyRound, Search, UserPlus, Users, XCircle } from "lucide-react";

function PortalAccountsDialog({ student, onUpdated }: { student: Student; onUpdated: (s: Student) => void }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [guardianEmail, setGuardianEmail] = useState(student.guardian_email ?? "");
  const [guardianPassword, setGuardianPassword] = useState("");
  const [studentConsent, setStudentConsent] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [submittingStudent, setSubmittingStudent] = useState(false);
  const [submittingGuardian, setSubmittingGuardian] = useState(false);

  async function handleCreateStudentAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmittingStudent(true);
    try {
      const updated = await api.createStudentAccount(token, user.school_id, student.id, {
        email: studentEmail,
        password: studentPassword,
      });
      onUpdated(updated);
      toast.success("Student login created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create student login");
    } finally {
      setSubmittingStudent(false);
    }
  }

  async function handleCreateGuardianAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmittingGuardian(true);
    try {
      const updated = await api.createGuardianAccount(token, user.school_id, student.id, {
        email: guardianEmail,
        password: guardianPassword,
        full_name: student.guardian_name || undefined,
      });
      onUpdated(updated);
      toast.success("Guardian login created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create guardian login");
    } finally {
      setSubmittingGuardian(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><KeyRound /> Portal access</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{student.first_name} {student.last_name} — Portal access</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Student login</span>
            {student.has_student_account ? (
              <Badge className="gap-1"><CheckCircle2 className="size-3.5" /> Active</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="size-3.5" /> Not set up</Badge>
            )}
          </div>
          {student.has_student_account && student.user_id ? (
            <ResetPasswordDialog userId={student.user_id} label={`${student.first_name} ${student.last_name}`} />
          ) : (
            <form onSubmit={handleCreateStudentAccount} className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <Input required type="email" placeholder="Student email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} className="w-48" />
                <Input required type="password" placeholder="Password" value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)} className="w-40" />
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox required checked={studentConsent} onCheckedChange={(v) => setStudentConsent(v === true)} className="mt-0.5" />
                I confirm the required consent has been obtained to create this account and process this student&apos;s data.
              </label>
              <Button size="sm" type="submit" disabled={submittingStudent || !studentConsent}>{submittingStudent ? "Creating..." : "Create login"}</Button>
            </form>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Guardian login</span>
            {student.has_guardian_account ? (
              <Badge className="gap-1"><CheckCircle2 className="size-3.5" /> Active</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="size-3.5" /> Not set up</Badge>
            )}
          </div>
          {student.has_guardian_account && student.guardian_user_id ? (
            <ResetPasswordDialog userId={student.guardian_user_id} label={student.guardian_name || "Guardian"} />
          ) : (
            <form onSubmit={handleCreateGuardianAccount} className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <Input required type="email" placeholder="Guardian email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} className="w-48" />
                <Input required type="password" placeholder="Password" value={guardianPassword} onChange={(e) => setGuardianPassword(e.target.value)} className="w-40" />
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox required checked={guardianConsent} onCheckedChange={(v) => setGuardianConsent(v === true)} className="mt-0.5" />
                I confirm the guardian has consented to this account and to Milai Group of Schools processing their and their child&apos;s data.
              </label>
              <Button size="sm" type="submit" disabled={submittingGuardian || !guardianConsent}>{submittingGuardian ? "Creating..." : "Create login"}</Button>
            </form>
          )}
          <p className="text-xs text-muted-foreground">
            If this email already has a guardian account (a sibling is already enrolled), this student is simply linked to it.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClassRoster({ classInfo, onBack }: { classInfo: MyClass; onBack: () => void }) {
  const { user, token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api
      .listStudents(token, user.school_id, classInfo.class_id)
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [token, user?.school_id, classInfo.class_id]);

  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.admission_number.toLowerCase().includes(q) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.guardian_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={classInfo.class_name} description={`${students.length} learner${students.length === 1 ? "" : "s"} in this class.`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> All my classes</Button>
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, admission #, or guardian..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        {loading ? (
          <PageLoader />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Guardian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.admission_number}</TableCell>
                  <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.guardian_name ?? "—"}</TableCell>
                </TableRow>
              ))}
              {filteredStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    {students.length === 0 ? "No students in this class yet." : "No students match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function TeacherStudentsView() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(() => {
    const fromUrl = searchParams.get("class_id");
    return fromUrl ? Number(fromUrl) : null;
  });

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listMyClasses(token, user.school_id).then(setMyClasses).catch(() => setMyClasses([])).finally(() => setClassesLoading(false));
  }, [token, user?.school_id]);

  const selectedClass = myClasses.find((c) => c.class_id === selectedClassId);

  if (classesLoading) return <PageLoader />;

  if (selectedClass) {
    return <ClassRoster key={selectedClass.class_id} classInfo={selectedClass} onBack={() => setSelectedClassId(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Students" description="Choose a class to see its roster." />
      {myClasses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You&apos;re not assigned to any classes yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {myClasses.map((c) => (
            <button key={c.class_id} type="button" onClick={() => setSelectedClassId(c.class_id)} className="text-left">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-primary/5">
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GraduationCap className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-heading text-sm font-semibold">{c.class_name}</p>
                      {c.is_homeroom_teacher && <Badge className="shrink-0">Class teacher</Badge>}
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3" /> {c.student_count} learners
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminStudentsView() {
  const { user, token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    admission_number: "",
    first_name: "",
    last_name: "",
    class_id: "",
    guardian_name: "",
    guardian_phone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canEnroll = user?.role === "school_admin" || user?.role === "staff" || user?.role === "super_admin" || user?.role === "supervisor";

  useEffect(() => {
    if (!token || !user?.school_id) return;
    Promise.all([
      api.listStudents(token, user.school_id).then(setStudents).catch(() => setStudents([])),
      api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([])),
    ]).finally(() => setLoading(false));
  }, [token, user?.school_id]);

  function classNameFor(classId: number | null) {
    if (!classId) return null;
    return classes.find((c) => c.id === classId)?.name ?? `#${classId}`;
  }

  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.admission_number.toLowerCase().includes(q) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.guardian_name ?? "").toLowerCase().includes(q) ||
      (classNameFor(s.class_id) ?? "").toLowerCase().includes(q)
    );
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.createStudent(token, user.school_id, {
        admission_number: form.admission_number,
        first_name: form.first_name,
        last_name: form.last_name,
        class_id: form.class_id ? Number(form.class_id) : undefined,
        guardian_name: form.guardian_name || undefined,
        guardian_phone: form.guardian_phone || undefined,
      });
      setStudents((s) => [...s, created]);
      setForm({ admission_number: "", first_name: "", last_name: "", class_id: "", guardian_name: "", guardian_phone: "" });
      toast.success(`${created.first_name} ${created.last_name} enrolled`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to enroll student");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Students" description="Enroll students and keep their records up to date." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Students" description="Enroll students and keep their records up to date." />

      {canEnroll && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enroll a student</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Admission number</Label>
                <Input required value={form.admission_number} onChange={(e) => set("admission_number", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>First name</Label>
                <Input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Last name</Label>
                <Input required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Class</Label>
                <Select value={form.class_id} onValueChange={(v) => set("class_id", v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Guardian name</Label>
                <Input value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Guardian phone</Label>
                <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button disabled={submitting} type="submit">
                  <UserPlus /> {submitting ? "Enrolling..." : "Enroll student"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 pb-0">
          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, admission #, class, or guardian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Guardian</TableHead>
              {canEnroll && <TableHead className="text-right">Portal</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.admission_number}</TableCell>
                <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                <TableCell>
                  {classNameFor(s.class_id) ? <Badge variant="secondary">{classNameFor(s.class_id)}</Badge> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.guardian_name ?? "—"}</TableCell>
                {canEnroll && (
                  <TableCell className="text-right">
                    <PortalAccountsDialog
                      student={s}
                      onUpdated={(updated) => setStudents((all) => all.map((st) => (st.id === updated.id ? updated : st)))}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredStudents.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEnroll ? 5 : 4} className="h-24 text-center text-muted-foreground">
                  {students.length === 0 ? "No students enrolled yet." : "No students match your search."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "teacher") return <TeacherStudentsView />;
  return <AdminStudentsView />;
}
