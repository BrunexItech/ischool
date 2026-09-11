"use client";

import Link from "next/link";
import { Users, ClipboardCheck, Award, Wallet, Video, Megaphone, ArrowRight, Settings2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const QUICK_LINKS = [
  { href: "/dashboard/students", label: "Students", description: "Enroll and manage student records", icon: Users, roles: ["school_admin", "teacher", "staff"] },
  { href: "/dashboard/attendance", label: "Attendance", description: "Mark today's attendance by class", icon: ClipboardCheck, roles: ["school_admin", "teacher", "staff"] },
  { href: "/dashboard/results", label: "Results", description: "Record scores and view grades", icon: Award, roles: ["school_admin", "teacher", "staff"] },
  { href: "/dashboard/fees", label: "Fees", description: "Invoices, payments, and balances", icon: Wallet, roles: ["school_admin", "staff"] },
  { href: "/dashboard/live-classes", label: "Live Classes", description: "Schedule and host video lessons", icon: Video, roles: ["school_admin", "teacher", "staff"] },
  { href: "/dashboard/announcements", label: "Announcements", description: "Share updates with your school", icon: Megaphone, roles: ["school_admin", "teacher", "staff", "student", "parent"] },
];

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const links = QUICK_LINKS.filter((l) => l.roles.includes(user.role));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome, ${user.full_name.split(" ")[0]}`}
        description="Here's what's happening at your school today."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <link.icon className="size-4.5" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base">{link.label}</CardTitle>
                <CardDescription className="mt-1">{link.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {user.role === "super_admin" && (
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Super Admin</CardTitle>
            </div>
            <CardDescription>Onboard new schools and manage their modules and branding.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/schools" className="text-sm font-medium text-primary hover:underline">
              Go to schools console →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
