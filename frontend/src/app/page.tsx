import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import heroPhoto from "../../public/hero/classroom.jpg";

const FEATURES = [
  {
    n: "01",
    title: "Attendance & results",
    description: "Daily attendance and graded results, tracked by class, subject, and term.",
  },
  {
    n: "02",
    title: "Fees & payments",
    description: "Invoices and balances that settle by M-Pesa or card — straight into your own account.",
  },
  {
    n: "03",
    title: "Live online classes",
    description: "Schedule a lesson, share a link, and teach from inside the same dashboard.",
  },
  {
    n: "04",
    title: "Announcements & bulk SMS",
    description: "Reach every parent by app and SMS at once, from your own sender ID.",
  },
  {
    n: "05",
    title: "Online exams",
    description: "Timed, auto-graded exams with resume-on-reload — no lost answers.",
  },
  {
    n: "06",
    title: "Multi-branch",
    description: "One login for every campus, each with its own staff, classes, and books.",
  },
];

const ROLES = [
  { title: "Administrators", description: "Run every branch, staff list, and fee structure from one console." },
  { title: "Teachers", description: "Mark attendance, grade exams, and plan a whole term's lessons." },
  { title: "Parents & guardians", description: "See results, pay fees, and get updates the moment they happen." },
  { title: "Students", description: "Check results, join live classes, and sit exams online." },
];

const DIFFERENTIATORS = [
  {
    index: "01 — Money",
    statement: "Your M-Pesa till. Your Pesapal account. Your SMS sender ID.",
    description:
      "Connect your own accounts and keep them. We never touch your school's funds or hold your comms credentials — payments and messages go out under your name, not ours.",
  },
  {
    index: "02 — Brand",
    statement: "Your logo, your colors, your domain.",
    description:
      "Parents and staff see your school's identity end to end — not a platform wearing your logo as an afterthought.",
  },
  {
    index: "03 — Fit",
    statement: "Built for how Kenyan schools actually run.",
    description:
      "M-Pesa and card payments, SMS that reaches feature phones, multi-branch support from day one — not bolted on after the fact.",
  },
];

const INK = "#1f2a20";
const PAPER = "#cdd7c4";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: PAPER, color: INK }}>
      <header
        className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-5 backdrop-blur-md lg:px-12"
        style={{ backgroundColor: `${PAPER}cc`, borderBottom: `1px solid ${INK}1f` }}
      >
        <span className="font-display text-xl font-medium tracking-tight">
          i<span className="text-primary">School</span>
        </span>
        <nav className="hidden items-center gap-8 text-xs font-medium tracking-wide uppercase md:flex" style={{ color: `${INK}99` }}>
          <a href="#what" className="transition-colors hover:opacity-100" style={{ color: "inherit" }}>What it does</a>
          <a href="#who" className="transition-colors hover:opacity-100" style={{ color: "inherit" }}>Who it&apos;s for</a>
          <a href="#why" className="transition-colors hover:opacity-100" style={{ color: "inherit" }}>Why iSchool</a>
        </nav>
        <Button
          variant="outline"
          className="bg-transparent hover:bg-black/5"
          style={{ borderColor: `${INK}40`, color: INK }}
          render={<Link href="/login">Sign in</Link>}
        />
      </header>

      <main className="flex-1">
        {/* Hero — full-bleed duotone photo */}
        <section className="relative flex min-h-[100svh] items-end overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src={heroPhoto}
              alt="A teacher and students at a classroom whiteboard"
              fill
              sizes="100vw"
              className="object-cover grayscale contrast-110"
              style={{ objectPosition: "68% 38%" }}
              priority
            />
            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{ background: `linear-gradient(135deg, ${PAPER}99, ${INK}66)` }}
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${PAPER} 10%, ${PAPER}88 45%, transparent 85%)` }}
            />
          </div>

          <div className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-32 lg:px-12 lg:pb-24">
            <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
              iSchool — school management
            </p>
            <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[1.05] font-medium tracking-tight text-balance sm:text-7xl">
              Run your school.
              <br />
              Keep your money, your brand.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-balance" style={{ color: `${INK}b3` }}>
              Attendance, grading, fees, live classes, and parent communication —
              while your M-Pesa till, your SMS sender ID, and your logo stay
              exactly yours.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Button size="lg" render={<Link href="/login">Sign in</Link>} />
              <a href="#what" className="text-sm font-medium underline-offset-4 hover:underline">
                See what&apos;s inside ↓
              </a>
            </div>
          </div>
        </section>

        {/* What it does — numbered editorial list, no icons */}
        <section id="what" className="mx-auto max-w-7xl px-6 py-24 lg:px-12">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">What it does</p>
          <h2 className="font-display mt-4 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Everything your school already pays six different apps for.
          </h2>

          <div className="mt-12" style={{ borderTop: `1px solid ${INK}26` }}>
            {FEATURES.map((f) => (
              <div
                key={f.n}
                className="flex flex-col gap-2 py-7 sm:flex-row sm:items-baseline sm:gap-10"
                style={{ borderBottom: `1px solid ${INK}26` }}
              >
                <span className="font-display text-xl text-primary sm:w-12 sm:shrink-0">{f.n}</span>
                <h3 className="text-lg font-medium sm:w-72 sm:shrink-0">{f.title}</h3>
                <p className="max-w-md" style={{ color: `${INK}99` }}>{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Who it's for — divided row, no icon cards */}
        <section id="who" style={{ borderTop: `1px solid ${INK}26` }}>
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-12">
            <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Who it&apos;s for</p>
            <h2 className="font-display mt-4 max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Everyone in your school, one login each.
            </h2>
            <div
              className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4"
              style={{ borderTop: `1px solid ${INK}26`, borderLeft: `1px solid ${INK}26` }}
            >
              {ROLES.map((role) => (
                <div
                  key={role.title}
                  className="p-7"
                  style={{ borderRight: `1px solid ${INK}26`, borderBottom: `1px solid ${INK}26` }}
                >
                  <h3 className="font-display text-2xl">{role.title}</h3>
                  <p className="mt-3 text-sm" style={{ color: `${INK}99` }}>{role.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why iSchool — asymmetric pull-quote rows */}
        <section id="why" style={{ borderTop: `1px solid ${INK}26` }}>
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-12">
            <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Why iSchool</p>
            <h2 className="font-display mt-4 max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Not a copy-paste school app.
            </h2>

            <div className="mt-12" style={{ borderTop: `1px solid ${INK}26` }}>
              {DIFFERENTIATORS.map((d) => (
                <div
                  key={d.index}
                  className="grid gap-4 py-10 sm:grid-cols-[140px_1fr]"
                  style={{ borderBottom: `1px solid ${INK}26` }}
                >
                  <span className="text-sm" style={{ color: `${INK}80` }}>{d.index}</span>
                  <div>
                    <p className="font-display max-w-2xl text-2xl text-balance sm:text-3xl">{d.statement}</p>
                    <p className="mt-4 max-w-xl" style={{ color: `${INK}99` }}>{d.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section style={{ borderTop: `1px solid ${INK}26` }}>
          <div className="mx-auto max-w-7xl px-6 py-24 text-center lg:px-12">
            <h2 className="font-display mx-auto max-w-lg text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Ready to bring your school online?
            </h2>
            <p className="mx-auto mt-4 max-w-md" style={{ color: `${INK}99` }}>
              If your school is already set up on iSchool, sign in below. New
              school? Ask your administrator to get your account provisioned.
            </p>
            <div className="mt-8">
              <Button size="lg" render={<Link href="/login">Sign in</Link>} />
            </div>
          </div>
        </section>
      </main>

      <footer
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-6 text-sm"
        style={{ borderTop: `1px solid ${INK}26`, color: `${INK}80` }}
      >
        <span>© {new Date().getFullYear()} iSchool</span>
        <Link href="/privacy" className="hover:underline" style={{ color: "inherit" }}>Privacy Policy</Link>
        <Link href="/terms" className="hover:underline" style={{ color: "inherit" }}>Terms of Service</Link>
      </footer>
    </div>
  );
}
