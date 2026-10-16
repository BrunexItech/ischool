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
import { Spinner } from "@/components/Spinner";
import { LoginCanvasBackground } from "@/components/LoginCanvasBackground";

interface Branding {
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
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
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {!branding && <LoginCanvasBackground />}

      <div
        className={
          branding
            ? "relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"
            : "relative z-10 hidden flex-col justify-between overflow-hidden p-10 lg:flex"
        }
        style={
          branding
            ? { background: `linear-gradient(to bottom right, ${branding.primary_color}, ${branding.primary_color}, ${branding.secondary_color})` }
            : undefined
        }
      >
        {branding && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_50%)]" />
        )}

        <div className="relative flex items-center gap-2">
          <div className={branding ? "flex size-9 items-center justify-center rounded-lg bg-white/15" : "flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"}>
            <GraduationCap className="size-5" />
          </div>
          <span className={branding ? "text-lg font-semibold" : "text-lg font-semibold text-foreground"}>{schoolName}</span>
        </div>

        <div className="relative space-y-4">
          {!branding && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              The complete school management platform
            </span>
          )}
          <h2 className={branding ? "text-3xl font-semibold leading-tight" : "text-4xl font-semibold leading-tight tracking-tight text-foreground"}>
            Everything your school needs, in one place.
          </h2>
          <p className={branding ? "max-w-md text-sm text-primary-foreground/80" : "max-w-md text-sm text-muted-foreground"}>
            Attendance, results, fees, communication, and live classes — built for schools
            and colleges, white-labeled for every institution on board.
          </p>
        </div>
        <p className={branding ? "relative text-xs text-primary-foreground/60" : "relative text-xs text-muted-foreground"}>© {new Date().getFullYear()} iSchool</p>
      </div>

      <div className={branding ? "flex items-center justify-center bg-background p-6" : "relative z-10 flex items-center justify-center p-6"}>
        <Card className="w-full max-w-sm rounded-2xl border-none shadow-none lg:border lg:shadow-xl lg:backdrop-blur-sm" style={!branding ? { backgroundColor: "rgba(255,255,255,0.85)" } : undefined}>
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
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
