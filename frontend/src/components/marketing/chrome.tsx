import Link from "next/link";
import { Button } from "@/components/ui/button";

export const INK = "#17283a";
export const PAPER = "#cfe1ee";
export const SURFACE = "rgba(255,255,255,0.55)";
export const SHADOW = "0 30px 60px -25px rgba(23,40,58,0.35)";

const NAV = [
  { href: "/features", label: "What it does" },
  { href: "/for-schools", label: "Who it's for" },
  { href: "/why", label: "Why iSchool" },
];

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: GRAIN }}
    />
  );
}

export function AtmosphereBlob({
  className,
  color = "var(--color-primary)",
}: {
  className: string;
  color?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-[110px] ${className}`}
      style={{ background: color }}
    />
  );
}

export function MarketingHeader() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-5 backdrop-blur-md lg:px-12"
      style={{ backgroundColor: `${PAPER}cc`, borderBottom: `1px solid ${INK}1f` }}
    >
      <Link href="/" className="font-display text-xl font-medium tracking-tight">
        i<span className="text-primary">School</span>
      </Link>
      <nav className="hidden items-center gap-8 text-xs font-medium tracking-wide uppercase md:flex" style={{ color: `${INK}99` }}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="transition-opacity hover:opacity-100" style={{ color: "inherit" }}>
            {item.label}
          </Link>
        ))}
      </nav>
      <Button
        variant="outline"
        className="bg-transparent hover:bg-black/5"
        style={{ borderColor: `${INK}40`, color: INK }}
        render={<Link href="/login">Sign in</Link>}
      />
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-6 text-sm"
      style={{ borderTop: `1px solid ${INK}26`, color: `${INK}80` }}
    >
      <span>© {new Date().getFullYear()} iSchool</span>
      <Link href="/privacy" className="hover:underline" style={{ color: "inherit" }}>Privacy Policy</Link>
      <Link href="/terms" className="hover:underline" style={{ color: "inherit" }}>Terms of Service</Link>
    </footer>
  );
}

export function PageIntro({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="relative mx-auto max-w-7xl px-6 pt-40 pb-4 lg:px-12 lg:pt-48">
      <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
      <h1 className="font-display mt-4 max-w-2xl text-4xl font-medium tracking-tight text-balance sm:text-5xl">
        {title}
      </h1>
    </div>
  );
}

export function ClosingCTA() {
  return (
    <section className="relative px-6 py-28 lg:px-12">
      <div
        className="relative mx-auto max-w-3xl overflow-hidden rounded-[2rem] px-8 py-16 text-center"
        style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}14` }}
      >
        <AtmosphereBlob className="-right-16 -top-16 size-64 opacity-40" />
        <h2 className="font-display relative mx-auto max-w-lg text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Ready to bring your school online?
        </h2>
        <p className="relative mx-auto mt-4 max-w-md" style={{ color: `${INK}99` }}>
          If your school is already set up on iSchool, sign in below. New
          school? Ask your administrator to get your account provisioned.
        </p>
        <div className="relative mt-8">
          <Button size="lg" render={<Link href="/login">Sign in</Link>} />
        </div>
      </div>
    </section>
  );
}
