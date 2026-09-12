"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StudentRecordView } from "@/components/StudentRecordView";

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [child, setChild] = useState<Student | null>(null);

  useEffect(() => {
    if (!loading && user && user.role !== "parent") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.listMyChildren(token).then((children) => {
      setChild(children.find((c) => c.id === Number(id)) ?? null);
    });
  }, [token, id]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={child ? `${child.first_name} ${child.last_name}` : "Loading..."}
        description={child ? `Admission #${child.admission_number}` : undefined}
      />
      <StudentRecordView studentId={Number(id)} />
    </div>
  );
}
