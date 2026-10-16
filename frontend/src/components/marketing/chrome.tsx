import Link from "next/link";
import { Button } from "@/components/ui/button";

// Premium enterprise palette — deep ink navy, off-white surfaces, the
// product's own accent teal/green doing the work of color (used sparingly).
export const INK = "#172033";
export const MUTED = "#687386";
export const BORDER = "#e4e8f0";
export const BG = "#f7f8fc";
export const CREAM = BG; // kept for backward compatibility with existing pages
export const SURFACE = "#ffffff";
export const DARK = "#0d1526";
export const SHADOW = "0 24px 48px -24px rgba(16,27,51,0.18)";
export const SHADOW_LG = "0 40px 80px -30px rgba(16,27,51,0.28)";

export const BADGES = [
  { bg: "#e3edfd", fg: "#2f6fd1" },
  { bg: "#fdeedd", fg: "#c2790f" },
  { bg: "#fde3ea", fg: "#c23e68" },
  { bg: "#eee3fd", fg: "#6b3fc2" },
  { bg: "#dff3ec", fg: "#1a7a56" },
  { bg: "#fde7e0", fg: "#c2501f" },
];

const NAV = [
  { href: "/features", label: "Platform" },
  { href: "/for-schools", label: "Who it's for" },
  { href: "/why", label: "Why iSchool" },
];

export function IconBadge({ icon: Icon, index }: { icon: React.ComponentType<{ className?: string }>; index: number }) {
  const c = BADGES[index % BADGES.length];
  return (
    <div className="flex size-11 items-center justify-center rounded-xl" style={{ backgroundColor: c.bg, color: c.fg }}>
      <Icon className="size-5" />
    </div>
  );
}

export function MarketingHeader() {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 backdrop-blur-md lg:px-12"
      style={{ backgroundColor: `${BG}f0`, borderBottom: `1px solid ${BORDER}` }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: DARK }}>
          i
        </span>
        <span className="text-lg font-semibold tracking-tight" style={{ color: INK }}>iSchool</span>
      </Link>
      <nav className="hidden items-center gap-8 text-sm font-medium md:flex" style={{ color: MUTED }}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="transition-colors hover:text-[#172033]" style={{ color: "inherit" }}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <Link href="/login" className="hidden text-sm font-medium sm:inline" style={{ color: INK }}>
          Sign in
        </Link>
        <Button className="rounded-lg" render={<Link href="/login">Explore the platform</Link>} />
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const groups = [
    {
      title: "Platform",
      links: [
        { href: "/features", label: "What it does" },
        { href: "/for-schools", label: "Who it's for" },
        { href: "/why", label: "Why iSchool" },
      ],
    },
    {
      title: "Account",
      links: [{ href: "/login", label: "Sign in" }],
    },
    {
      title: "Legal",
      links: [
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/terms", label: "Terms of Service" },
      ],
    },
  ];
  return (
    <footer style={{ backgroundColor: DARK, color: "rgba(255,255,255,0.6)" }}>
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-12">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <span className="text-lg font-semibold text-white">iSchool</span>
            <p className="mt-3 max-w-xs text-sm">
              One connected system for attendance, academics, fees, and
              communication — built for schools and colleges in Kenya.
            </p>
          </div>
          {groups.map((g) => (
            <div key={g.title}>
              <p className="text-xs font-semibold tracking-wide text-white/40 uppercase">{g.title}</p>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="transition-colors hover:text-white">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-xs" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <span>© {new Date().getFullYear()} iSchool. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

export function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className="text-xs font-semibold tracking-[0.18em] uppercase"
      style={{ color: dark ? "#5eead4" : "#0d9488" }}
    >
      {children}
    </p>
  );
}

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-4 lg:px-12 lg:pt-24">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl" style={{ color: INK }}>
        {title}
      </h1>
      {description ? <p className="mt-4 max-w-lg text-lg text-balance" style={{ color: MUTED }}>{description}</p> : null}
    </div>
  );
}

export function ClosingCTA() {
  return (
    <section className="relative px-6 py-24 lg:px-12" style={{ backgroundColor: DARK }}>
      <div className="relative mx-auto max-w-3xl text-center">
        <Eyebrow dark>Get started</Eyebrow>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
          Ready to bring your school online?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-white/60">
          If your school is already set up on iSchool, sign in below. New
          school? Ask your administrator to get your account provisioned.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" className="rounded-lg" render={<Link href="/login">Sign in</Link>} />
          <Button size="lg" variant="outline" className="rounded-lg border-white/20 bg-transparent text-white hover:bg-white/10" render={<Link href="/features">Explore the platform</Link>} />
        </div>
      </div>
    </section>
  );
}
