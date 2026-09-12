"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getTenantSlug } from "@/lib/tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Branding {
  name: string;
  logo_url: string | null;
  primary_color: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      .then((school) => setBranding({ name: school.name, logo_url: school.logo_url, primary_color: school.primary_color }))
      .catch(() => setBranding(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const loggedInUser = await login(email, password);
      router.replace(loggedInUser.must_change_password ? "/change-password" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const schoolName = branding?.name ?? "iSchool";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-sidebar p-10 text-primary-foreground lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_50%)]" />
        <div className="relative flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-lg font-semibold">iSchool</span>
        </div>
        <div className="relative space-y-3">
          <h2 className="text-3xl font-semibold leading-tight">
            Everything your school needs, in one place.
          </h2>
          <p className="max-w-md text-sm text-primary-foreground/80">
            Attendance, results, fees, communication, and live classes — built for schools
            and colleges, white-labeled for every institution on board.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">© {new Date().getFullYear()} iSchool</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm border-none shadow-none lg:border lg:shadow-sm">
          <CardHeader className="text-center">
            {branding?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo_url} alt={schoolName} className="mx-auto mb-2 h-10" />
            )}
            <CardTitle className="text-xl">{schoolName}</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
