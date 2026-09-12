"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap } from "lucide-react";
import { api, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function MyChildrenPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && user.role !== "parent") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.listMyChildren(token).then(setChildren).catch(() => setChildren([])).finally(() => setDataLoading(false));
  }, [token]);

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Children" description="View attendance, results, and fees for each of your children." />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Children" description="View attendance, results, and fees for each of your children." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((child) => (
          <Link key={child.id} href={`/dashboard/children/${child.id}`}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="size-4.5" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base">{child.first_name} {child.last_name}</CardTitle>
                <CardDescription className="mt-1">Admission #{child.admission_number}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
        {children.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground">No children linked to your account yet — ask your school to link them.</p>
        )}
      </div>
    </div>
  );
}
