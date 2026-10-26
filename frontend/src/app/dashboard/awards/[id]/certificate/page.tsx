"use client";

import { use, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { api, Award } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BackButton } from "@/components/BackButton";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, token, loading } = useAuth();
  const [award, setAward] = useState<{ id: string; value: Award | null } | null>(null);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    api
      .getAward(token, user.school_id, Number(id))
      .then((a) => !cancelled && setAward({ id, value: a }))
      .catch(() => !cancelled && setAward({ id, value: null }));
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, id]);

  if (loading || !award || award.id !== id) return <PageLoader />;
  const a = award.value;
  if (!a) {
    return (
      <div className="flex flex-col gap-4">
        <BackButton fallback="/dashboard/awards" label="Awards" />
        <p className="text-sm text-muted-foreground">Award not found.</p>
      </div>
    );
  }

  const heading = a.scope === "school" ? "the whole school" : a.recipient_name;
  const date = new Date(a.date_awarded + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-5">
      <style>{`@media print { @page { size: landscape; margin: 8mm; } }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackButton fallback="/dashboard/awards" label="Awards" />
        <Button className="h-10 sm:h-9" onClick={() => window.print()}><Printer /> Print certificate</Button>
      </div>

      <div className="mx-auto w-full max-w-4xl bg-white text-neutral-900 shadow-sm print:max-w-none print:shadow-none">
        <div className="border-[6px] border-[#8B1A1D] p-1.5">
          <div className="border border-[#FFA819] px-5 py-8 text-center sm:px-14 sm:py-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Milai-School-Logo.svg" alt="Milai School" className="mx-auto h-16 w-auto sm:h-24" />
            <p className="mt-6 text-xs font-semibold tracking-[0.35em] text-[#8B1A1D] uppercase sm:text-sm">Certificate of Achievement</p>
            <p className="mt-6 text-sm text-neutral-600 italic">This certificate is proudly presented to</p>
            <p className="mt-3 font-heading text-3xl font-semibold break-words text-[#8B1A1D] sm:text-5xl">{heading}</p>
            <div className="mx-auto mt-5 h-px w-40 bg-[#FFA819]" />
            <p className="mt-5 text-sm text-neutral-600 italic">in recognition of</p>
            <p className="mt-2 font-heading text-xl font-semibold break-words sm:text-3xl">{a.title}</p>
            {a.subject_name && <p className="mt-1 text-sm text-neutral-600">{a.subject_name}</p>}
            {a.description && <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed break-words text-neutral-700">{a.description}</p>}
            <p className="mt-5 text-xs text-neutral-500">
              {a.class_name && a.scope === "student" ? `${a.class_name} · ` : ""}
              {a.term ? `${a.term} · ` : ""}
              {date}
            </p>

            <div className="mt-10 grid grid-cols-2 gap-8 text-xs sm:mt-14">
              <div>
                <div className="border-t border-neutral-400 pt-2">{a.awarded_by_name ?? "Awarded by"}</div>
                <p className="text-neutral-500">Presented by</p>
              </div>
              <div>
                <div className="border-t border-neutral-400 pt-2">&nbsp;</div>
                <p className="text-neutral-500">Head of institution</p>
              </div>
            </div>
            <p className="mt-8 text-[10px] tracking-[0.25em] text-[#8B1A1D] uppercase">Nurture With Excellence</p>
          </div>
        </div>
      </div>
    </div>
  );
}
