import { BookOpen, Award, CalendarCheck, ClipboardCheck, FileText, HeartHandshake, Bell, ShieldCheck, Users, Video, Wallet, Wallet2 } from "lucide-react";
import type { LoginAudienceConfig } from "@/components/LoginForm";
import type { UserRole } from "@/lib/api";

const STAFF_ROLES: UserRole[] = [
  "super_admin",
  "teacher",
  "staff",
  "security",
  "boarding_staff",
  "transport_staff",
  "transport_attendant",
  "librarian",
  "store_keeper",
  "accountant",
  "procurement_officer",
  "bursar",
  "secretary",
];

export const STAFF_LOGIN: LoginAudienceConfig = {
  audience: "staff",
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

export const PARENT_LOGIN: LoginAudienceConfig = {
  audience: "parent",
  heroTitle: <>Stay close to your child&apos;s day, from anywhere.</>,
  features: [
    { icon: CalendarCheck, label: "Attendance, results and report cards" },
    { icon: Wallet, label: "Fee balances and M-Pesa payment" },
    { icon: Bell, label: "School announcements, instantly" },
    { icon: HeartHandshake, label: "Confirm pickup and drop-off in one tap" },
  ],
  pageTitle: "Parent sign in",
  pageSubtitle: "Use the email and password the school gave you.",
  allowedRoles: ["parent"],
  wrongRoleMessage: "That's not a parent account. Use the staff or student sign-in instead.",
};

export const STUDENT_LOGIN: LoginAudienceConfig = {
  audience: "student",
  heroTitle: <>Your classes, results and homework, all in one place.</>,
  features: [
    { icon: BookOpen, label: "Homework and exams" },
    { icon: FileText, label: "Results and report cards" },
    { icon: Award, label: "Awards and activities" },
    { icon: Video, label: "Join live classes" },
  ],
  pageTitle: "Student sign in",
  pageSubtitle: "Use the email and password your school gave you.",
  allowedRoles: ["student"],
  wrongRoleMessage: "That's not a student account. Use the staff or parent sign-in instead.",
};
