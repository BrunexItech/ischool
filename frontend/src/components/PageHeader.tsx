"use client";

import { ReactNode } from "react";
import { ModuleBanner } from "@/components/ModuleBanner";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return <ModuleBanner title={title} description={description}>{action}</ModuleBanner>;
}
