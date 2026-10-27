"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { PageLoader } from "@/components/Spinner";
import { StudentRecordView } from "@/components/StudentRecordView";
import { Empty } from "@/components/family/FamilyUi";

function MyRecord() {
  const { cards, active } = useFamily();
  if (cards === undefined) return <PageLoader label="Opening your record..." />;
  if (!active) return <Empty icon={<GraduationCap />} title="No student record is linked to your account yet">Please ask the school office to link your learner record.</Empty>;
  return <StudentRecordView studentId={active.student.id} student={active.student} />;
}

export default function MyRecordsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && user.role !== "student") router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <Suspense fallback={<PageLoader />}>
      <MyRecord />
    </Suspense>
  );
}
