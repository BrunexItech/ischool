"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="p-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-medium text-gray-900">Welcome, {user.full_name}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Classes, students, and staff are live. Attendance, results, fees, and communication
            modules will land here next, gated by what your school has enabled.
          </p>
          {user.role === "super_admin" && (
            <a
              href="/admin/schools"
              className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Manage schools →
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
