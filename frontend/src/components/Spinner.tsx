import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block animate-spin rounded-full border-[2.5px] border-current/15 border-t-current text-primary", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4" role="status" aria-label={label}>
      <div className="relative flex size-16 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <GraduationCap className="size-5" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="font-heading text-sm font-semibold tracking-tight text-foreground">Milai Group of Schools</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
