"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, Lock, Unlock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { BrandTheme } from "@/components/BrandTheme";
import { NotificationBell } from "@/components/NotificationBell";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, schoolOptions, viewingSchoolId, editingEnabled, toggleEditing } = useAuth();
  const isSupervisorViewing = user?.role === "supervisor" && viewingSchoolId !== null;
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
      <BrandTheme />
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
          {isSupervisorViewing && (
            <div className="ml-4 flex items-center gap-2 rounded-full border border-border bg-muted/60 py-1 pr-1 pl-3 text-xs">
              <Eye className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                Viewing <span className="font-medium text-foreground">{viewingSchoolName}</span>
              </span>
              <Button
                size="sm"
                variant={editingEnabled ? "default" : "outline"}
                className="h-6 gap-1 rounded-full px-2.5 text-xs"
                onClick={toggleEditing}
              >
                {editingEnabled ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                {editingEnabled ? "Editing on" : "Enable editing"}
              </Button>
            </div>
          )}
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
        <div
          className={`flex flex-1 flex-col gap-4 p-4 transition-opacity md:p-6 ${
            isSupervisorViewing && !editingEnabled ? "pointer-events-none opacity-[0.97] grayscale-[0.15] select-none" : ""
          }`}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
