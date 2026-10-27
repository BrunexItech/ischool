"use client";

import { usePathname } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { PARENT_LOGIN, STAFF_LOGIN, STUDENT_LOGIN } from "@/lib/loginConfigs";

/** One sign-in page for staff, parents and students. Switching only swaps the words, so nothing reloads or flickers. */
export function LoginShell() {
  const pathname = usePathname();
  const config = pathname.startsWith("/login/parent") ? PARENT_LOGIN : pathname.startsWith("/login/student") ? STUDENT_LOGIN : STAFF_LOGIN;
  return <LoginForm config={config} />;
}
