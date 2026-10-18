"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, GraduationCap, Users, Video, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getTenantSlug } from "@/lib/tenant";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { WritingAnimation } from "@/components/WritingAnimation";

interface Branding {
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

const FEATURES = [
  { icon: Users, label: "Learners, attendance and CBC-style grading" },
  { icon: Wallet, label: "Fees with M-Pesa, receipts and balances" },
  { icon: Video, label: "Communication, live classes and announcements" },
  { icon: ClipboardCheck, label: "Transport, pickup and day-to-day operations" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace(user.must_change_password ? "/change-password" : "/dashboard");
  }, [user, router]);

  useEffect(() => {
    const slug = getTenantSlug();
    if (!slug) return;
    api
      .getSchoolBySlug(slug)
      .then((school) =>
        setBranding({ name: school.name, logo_url: school.logo_url, primary_color: school.primary_color, secondary_color: school.secondary_color })
      )
      .catch(() => setBranding(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const loggedInUser = await login(email, password, keepSignedIn);
      router.replace(loggedInUser.must_change_password ? "/change-password" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const schoolName = branding?.name ?? "Milai Group of Schools";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        style={{
          background: branding
            ? `linear-gradient(to bottom right, ${branding.primary_color}, ${branding.primary_color}, ${branding.secondary_color})`
            : "var(--sidebar)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15">
            {branding?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo_url} alt={schoolName} className="size-full object-contain p-1" />
            ) : (
              <GraduationCap className="size-5" />
            )}
          </div>
          <div>
            <p className="text-lg leading-none font-semibold">{schoolName}</p>
            <p className="mt-1 text-[0.68rem] tracking-widest text-white/50 uppercase">
              {branding ? "School management" : "Grow. Discover. Lead."}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="max-w-sm text-4xl leading-[1.1] font-semibold text-balance">
            {branding ? "Everything your school needs, in one place." : (
              <>One platform for Primary, Secondary and Campus.</>
            )}
          </h2>
          <ul className="flex flex-col gap-3.5">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-sm text-white/85">
                <f.icon className="size-4.5 shrink-0 text-white/60" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">© {new Date().getFullYear()} {schoolName}</p>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-4">
            <WritingAnimation />
          </div>
          <p className="flex items-center gap-2 text-[0.68rem] font-semibold tracking-widest text-muted-foreground uppercase">
            <span className="size-1.5 rounded-full bg-primary" /> Sign in
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the email and password the school gave you.</p>

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
