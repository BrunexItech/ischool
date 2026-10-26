"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Goes back to wherever the user came from; if the page was opened
 * directly (no history), goes to `fallback` instead. */
export function BackButton({ fallback, label = "Back", className = "" }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-10 w-fit sm:h-8 print:hidden ${className}`}
      onClick={() => (typeof window !== "undefined" && window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      <ArrowLeft /> {label}
    </Button>
  );
}
