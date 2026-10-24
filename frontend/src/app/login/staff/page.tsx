"use client";

import { Users, ClipboardCheck, ShieldCheck, Wallet2 } from "lucide-react";
import { LoginForm, LoginAudienceConfig } from "@/components/LoginForm";
import { UserRole } from "@/lib/api";

const STAFF_ROLES: UserRole[] = [
  "super_admin",
  "school_admin",
  "supervisor",
  "teacher",
  "staff",
  "security",
  "boarding_staff",
  "transport_staff",
  "bursar",
];

const config: LoginAudienceConfig = {
  heroTitle: <>Milai School 360, the school&apos;s complete management system: classes, finance and daily operations, all in one place.</>,
  features: [
    { icon: Users, label: "Classes, attendance and results" },
    { icon: Wallet2, label: "Fees, finance and payroll" },
    { icon: ShieldCheck, label: "Security, boarding and transport" },
    { icon: ClipboardCheck, label: "Communication and daily operations" },
  ],
  pageTitle: "Staff sign in",
  pageSubtitle: "For school admins, teachers, and every other staff role.",
  allowedRoles: STAFF_ROLES,
  wrongRoleMessage: "That's not a staff account. Use the parent or student sign-in instead.",
};

export default function StaffLoginPage() {
  return <LoginForm config={config} />;
}
