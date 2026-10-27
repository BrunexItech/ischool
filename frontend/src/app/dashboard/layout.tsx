"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, schoolOptions, viewingSchoolId, switchSchool } = useAuth();
  const isSupervisorViewing = user?.role === "group_principal" && viewingSchoolId !== null;
  const viewingSchoolName = schoolOptions.find((s) => s.id === viewingSchoolId)?.name;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.must_change_password) {
      router.replace("/change-password");
    }
  }, [loading, user, router]);

  if (loading || !user || user.must_change_password) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader label="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="size-9 rounded-lg border border-border bg-background shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
        {isSupervisorViewing && (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-sky-50 px-4 py-2.5 text-sm text-sky-950 md:px-6 dark:bg-sky-950/40 dark:text-sky-100">
            <Eye className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              You are looking at <strong className="font-semibold">{viewingSchoolName}</strong> the way its head of institution sees it. You can look at everything here, but changes are made by the head.
            </span>
            <Button size="sm" variant="outline" className="h-8 shrink-0 bg-background" onClick={() => { switchSchool(null); router.push("/dashboard"); }}>Back to All Schools</Button>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
