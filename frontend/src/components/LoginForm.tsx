"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { LucideIcon } from "lucide-react";
import { ApiError, UserRole } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { WritingAnimation } from "@/components/WritingAnimation";

const SCHOOL_NAME = "Milai School";

type Audience = "staff" | "parent" | "student" | "admin";

const AUDIENCE_TABS: { key: Audience; label: string; href: string }[] = [
  { key: "staff", label: "Staff", href: "/login/staff" },
  { key: "parent", label: "Parent", href: "/login/parent" },
  { key: "student", label: "Student", href: "/login/student" },
];

export interface LoginAudienceConfig {
  audience: Audience;
  heroTitle: React.ReactNode;
  features: { icon: LucideIcon; label: string }[];
  pageTitle: string;
  pageSubtitle: string;
  allowedRoles: UserRole[];
  wrongRoleMessage: string;
}

export function LoginForm({ config }: { config: LoginAudienceConfig }) {
  const router = useRouter();
  const { login, logout, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && config.allowedRoles.includes(user.role)) {
      router.replace(user.must_change_password ? "/change-password" : "/dashboard");
    }
  }, [user, router, config.allowedRoles]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const loggedInUser = await login(email, password, keepSignedIn);
      if (!config.allowedRoles.includes(loggedInUser.role)) {
        logout();
        setError(config.wrongRoleMessage);
        toast.error(config.wrongRoleMessage);
        return;
      }
      toast.success(`Welcome back, ${loggedInUser.full_name.split(" ")[0]}`);
      router.replace(loggedInUser.must_change_password ? "/change-password" : "/dashboard");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--sidebar)] p-10 text-white lg:flex">
        <div className="absolute inset-0">
          {
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/login-hero.jpg" alt="Students at Milai School" className="size-full object-cover" />
          }
        </div>
        <div className="relative flex items-center gap-3.5">
          {
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/mila-logo.png" alt={SCHOOL_NAME} className="size-20 shrink-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]" />
          }
          <div className="[text-shadow:0_2px_10px_rgba(0,0,0,0.65)]">
            <p className="text-2xl leading-tight font-semibold">{SCHOOL_NAME}</p>
            <p className="mt-0.5 text-[0.7rem] tracking-widest text-[#FFA819] uppercase">Nurturing Today · Empowering Tomorrow</p>
          </div>
        </div>

        <div className="space-y-6 [text-shadow:0_2px_12px_rgba(0,0,0,0.65)]">
          <h2 className="max-w-sm text-4xl leading-[1.1] font-semibold text-balance">{config.heroTitle}</h2>
          <ul className="flex flex-col gap-3.5">
            {config.features.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-sm text-white/95">
                <f.icon className="size-4.5 shrink-0 text-white/80" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative space-y-1 [text-shadow:0_2px_10px_rgba(0,0,0,0.65)]">
          <p className="text-sm font-medium text-white">Building strong foundations for life and learning.</p>
          <p className="text-xs text-white/70">© {new Date().getFullYear()} {SCHOOL_NAME}</p>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="relative flex flex-col bg-background lg:items-center lg:justify-center lg:p-6">
        {/* Mobile-only hero banner */}
        <div className="relative h-44 shrink-0 overflow-hidden lg:hidden">
          {
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/login-hero.jpg" alt="Milai School campus" className="size-full object-cover" />
          }
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-[#FFA819] to-primary" />
        </div>

        <div className="relative z-10 mx-auto -mt-9 w-full max-w-sm rounded-t-[2rem] bg-background px-6 pt-7 pb-10 lg:mt-0 lg:rounded-none lg:px-0 lg:py-0">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            {
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/mila-logo.png" alt={SCHOOL_NAME} className="size-14 shrink-0 drop-shadow-sm" />
            }
            <div>
              <p className="text-lg leading-tight font-semibold text-foreground">{SCHOOL_NAME}</p>
              <p className="text-[0.65rem] tracking-widest text-primary uppercase">Nurturing Today · Empowering Tomorrow</p>
            </div>
          </div>
          <div className="mb-4 hidden lg:block">
            <WritingAnimation />
          </div>
          {config.audience !== "admin" && (
          <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {AUDIENCE_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={
                  tab.key === config.audience
                    ? "rounded-lg bg-background py-1.5 text-center text-sm font-semibold text-foreground shadow-sm"
                    : "rounded-lg py-1.5 text-center text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {tab.label}
              </Link>
            ))}
          </div>
          )}
          <div className="h-1 w-10 rounded-full bg-[#FFA819]" />
          <div key={config.audience} className="animate-in fade-in duration-300">
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{config.pageTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{config.pageSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required placeholder="name@school.ke" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Keep me signed in on this device
              </label>
              <Link href="/forgot-password" className="shrink-0 text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={submitting} size="lg" className="w-full">
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
