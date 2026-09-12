"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { StudentRecordView } from "@/components/StudentRecordView";

export default function MyRecordsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [me, setMe] = useState<Student | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && user.role !== "student") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.getMyStudentRecord(token).then(setMe).catch(() => setMe(null)).finally(() => setDataLoading(false));
  }, [token]);

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Records" description="Your attendance, results, and fees." />
        <PageLoader />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Records" description="Your attendance, results, and fees." />
        <p className="text-sm text-muted-foreground">No student record is linked to this account yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Records" description={`Admission #${me.admission_number}`} />
      <StudentRecordView studentId={me.id} />
    </div>
  );
}
