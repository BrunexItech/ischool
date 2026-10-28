"use client";

import { Suspense, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { setActiveChildId, useFamily } from "@/lib/family";
import { PageLoader } from "@/components/Spinner";
import { StudentRecordView } from "@/components/StudentRecordView";
import { ChildSwitcher } from "@/components/family/ChildSwitcher";
import { Empty } from "@/components/family/FamilyUi";
import { GraduationCap } from "lucide-react";

function ChildRecord({ id }: { id: number }) {
  const { cards, list } = useFamily();
  const index = list.findIndex((c) => c.student.id === id);
  const card = index >= 0 ? list[index] : null;

  useEffect(() => {
    if (card) setActiveChildId(card.student.id);
  }, [card]);

  if (cards === undefined) return <PageLoader label="Opening the record..." />;
  if (!card) return <Empty icon={<GraduationCap />} title="We could not find that learner">They may not be linked to your account.</Empty>;
  return <StudentRecordView key={id} studentId={id} student={card.student} index={index} switcher={(tone) => <ChildSwitcher cards={list} currentId={id} tone={tone} />} />;
}

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && user.role !== "parent") router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<PageLoader />}>
        <ChildRecord id={Number(id)} />
      </Suspense>
    </div>
  );
}
