"use client";

import { use } from "react";
import { GroupComparisonView } from "@/components/group/GroupComparisonView";

export default function GroupModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = use(params);
  return <GroupComparisonView moduleKey={module} />;
}
