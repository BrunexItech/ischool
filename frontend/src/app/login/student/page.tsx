"use client";

import { BookOpen, Award, FileText, Video } from "lucide-react";
import { LoginForm, LoginAudienceConfig } from "@/components/LoginForm";

const config: LoginAudienceConfig = {
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

export default function StudentLoginPage() {
  return <LoginForm config={config} />;
}
