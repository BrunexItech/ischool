import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const INK = "#2b1f2a";
export const CREAM = "#fdfaf5";
export const DARK = "#101915";
export const SURFACE = "#ffffff";
export const SHADOW = "0 30px 60px -25px rgba(43,31,42,0.25)";

// Deep forest teal fading into warm gold — distinct from any reference site,
// but still rooted in the product's own brand green.
export const HERO_GRADIENT =
  "linear-gradient(115deg, #0f2a21 0%, #1f6e52 38%, #d9a455 78%, #efc789 100%)";
export const CTA_GRADIENT =
  "linear-gradient(135deg, #efc789 0%, #e8a06e 55%, #e78a8a 100%)";

export const BADGES = [
  { bg: "#e3edfd", fg: "#2f6fd1" },
  { bg: "#fdeedd", fg: "#c2790f" },
  { bg: "#fde3ea", fg: "#c23e68" },
  { bg: "#eee3fd", fg: "#6b3fc2" },
  { bg: "#dff3ec", fg: "#1a7a56" },
  { bg: "#fde7e0", fg: "#c2501f" },
];

const NAV = [
  { href: "/features", label: "What it does" },
  { href: "/for-schools", label: "Who it's for" },
  { href: "/why", label: "Why iSchool" },
];

const TRUST_BADGES = ["M-Pesa & card payments", "Bulk SMS", "Multi-branch", "Fully white-labeled"];

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.035] mix-blend-overlay"
      style={{ backgroundImage: GRAIN }}
    />
  );
}

export function IconBadge({ icon: Icon, index }: { icon: React.ComponentType<{ className?: string }>; index: number }) {
  const c = BADGES[index % BADGES.length];
  return (
    <div
      className="flex size-11 items-center justify-center rounded-xl"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <Icon className="size-5" />
    </div>
  );
}

function UtilityBar() {
  return (
    <div className="hidden items-center justify-center gap-7 px-6 py-2.5 text-xs font-medium tracking-wide text-white/80 sm:flex" style={{ backgroundColor: DARK }}>
      {TRUST_BADGES.map((item) => (
        <span key={item} className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-primary" />
          {item}
        </span>
      ))}
    </div>
  );
}

export function MarketingHeader() {
  return (
    <div className="sticky top-0 z-40">
      <UtilityBar />
      <header
        className="flex items-center justify-between px-6 py-4 backdrop-blur-md lg:px-12"
        style={{ backgroundColor: `${CREAM}f2`, borderBottom: `1px solid ${INK}14` }}
      >
        <Link href="/" className="font-display text-xl font-medium tracking-tight">
          i<span className="text-primary">School</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex" style={{ color: `${INK}99` }}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-opacity hover:opacity-100" style={{ color: "inherit" }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Button className="rounded-full" render={<Link href="/login">Sign in</Link>} />
      </header>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-6 text-sm"
      style={{ borderTop: `1px solid ${INK}1a`, color: `${INK}80`, backgroundColor: CREAM }}
    >
      <span>© {new Date().getFullYear()} iSchool</span>
      <Link href="/privacy" className="hover:underline" style={{ color: "inherit" }}>Privacy Policy</Link>
      <Link href="/terms" className="hover:underline" style={{ color: "inherit" }}>Terms of Service</Link>
    </footer>
  );
}

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-4 lg:px-12 lg:pt-24">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
      <h1 className="font-display mt-4 max-w-2xl text-4xl font-medium tracking-tight text-balance sm:text-5xl" style={{ color: INK }}>
        {title}
      </h1>
      {description ? (
        <p className="mt-4 max-w-lg text-lg text-balance" style={{ color: `${INK}99` }}>{description}</p>
      ) : null}
    </div>
  );
}

export function ClosingCTA() {
  return (
    <section className="relative px-6 py-24 lg:px-12" style={{ backgroundColor: CREAM }}>
      <div
        className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] px-8 py-16 text-center"
        style={{ background: CTA_GRADIENT }}
      >
        <h2 className="font-display relative mx-auto max-w-lg text-3xl font-medium tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
          Ready to bring your school online?
        </h2>
        <p className="relative mx-auto mt-4 max-w-md" style={{ color: `${INK}b3` }}>
          If your school is already set up on iSchool, sign in below. New
          school? Ask your administrator to get your account provisioned.
        </p>
        <div className="relative mt-8">
          <Button size="lg" className="rounded-full" render={<Link href="/login">Sign in</Link>} />
        </div>
      </div>
    </section>
  );
}
