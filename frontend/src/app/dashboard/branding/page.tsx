"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, Upload } from "lucide-react";
import { api, ApiError, School } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function BrandingPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1D4ED8");
  const [secondaryColor, setSecondaryColor] = useState("#111827");
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user && user.role !== "school_admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api
      .getSchool(token, user.school_id)
      .then((s) => {
        setSchool(s);
        setName(s.name);
        setPrimaryColor(s.primary_color);
        setSecondaryColor(s.secondary_color);
      })
      .finally(() => setDataLoading(false));
  }, [token, user?.school_id]);

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSavingDetails(true);
    try {
      const updated = await api.updateBranding(token, user.school_id, {
        name,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      setSchool(updated);
      toast.success("Branding updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update branding");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token || !user?.school_id) return;
    setUploadingLogo(true);
    try {
      const updated = await api.uploadSchoolLogo(token, user.school_id, file);
      setSchool(updated);
      toast.success("Logo updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Branding" description="How your school appears across the platform — login page, portal, report cards." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {school?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logo_url} alt={school.name} className="size-16 rounded-full border object-cover" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full border bg-muted">
              <GraduationCap className="size-7 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="hidden" />
            <Button type="button" variant="outline" disabled={uploadingLogo} onClick={() => fileInputRef.current?.click()}>
              {uploadingLogo ? <Spinner size={16} className="text-current" /> : <Upload />} {uploadingLogo ? "Uploading..." : "Upload logo"}
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPEG, or WEBP — up to 2MB.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveDetails} className="grid gap-4 sm:grid-cols-2">
            <div className="col-span-full grid gap-1.5">
              <Label>School name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Primary color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="size-9 shrink-0 rounded border" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Secondary color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="size-9 shrink-0 rounded border" />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
              </div>
            </div>
            <div className="col-span-full">
              <Button type="submit" disabled={savingDetails}>
                {savingDetails && <Spinner size={16} className="text-current" />} {savingDetails ? "Saving..." : "Save details"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
