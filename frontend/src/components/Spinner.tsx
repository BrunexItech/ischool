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
      <div className="relative flex size-20 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
        {
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/mila-logo.png" alt="Milai School" className="size-12" />
        }
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="font-heading text-sm font-semibold tracking-tight text-foreground">Milai School</p>
        <p className="text-[0.65rem] tracking-widest text-primary uppercase">Nurture with Excellence</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
