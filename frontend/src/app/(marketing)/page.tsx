import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ClosingCTA, DARK, HERO_GRADIENT, INK, SURFACE, SHADOW } from "@/components/marketing/chrome";
import heroPhoto from "../../../public/hero/classroom.jpg";

const FEATURES = [
  { n: "01", title: "Attendance & results", description: "Daily attendance and graded results, tracked by class, subject, and term." },
  { n: "02", title: "Fees & payments", description: "Invoices and balances that settle by M-Pesa or card — straight into your own account." },
  { n: "03", title: "Live online classes", description: "Schedule a lesson, share a link, and teach from inside the same dashboard." },
  { n: "04", title: "Announcements & bulk SMS", description: "Reach every parent by app and SMS at once, from your own sender ID." },
  { n: "05", title: "Online exams", description: "Timed, auto-graded exams with resume-on-reload — no lost answers." },
  { n: "06", title: "Multi-branch", description: "One login for every campus, each with its own staff, classes, and books." },
];

const ROLES = [
  { title: "Administrators", description: "Run every branch, staff list, and fee structure from one console." },
  { title: "Teachers", description: "Mark attendance, grade exams, and plan a whole term's lessons." },
  { title: "Parents & guardians", description: "See results, pay fees, and get updates the moment they happen." },
  { title: "Students", description: "Check results, join live classes, and sit exams online." },
];

const DIFFERENTIATORS = [
  {
    n: "01",
    label: "Money",
    statement: "Your M-Pesa till. Your Pesapal account. Your SMS sender ID.",
    description: "We never touch your school's funds or hold your comms credentials — payments and messages go out under your name, not ours.",
  },
  {
    n: "02",
    label: "Brand",
    statement: "Your logo, your colors, your domain.",
    description: "Parents and staff see your school's identity end to end — not a platform wearing your logo as an afterthought.",
  },
  {
    n: "03",
    label: "Fit",
    statement: "Built for how Kenyan schools actually run.",
    description: "M-Pesa and card payments, SMS that reaches feature phones, multi-branch support from day one.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative z-0 -mt-8 flex min-h-[92vh] items-center overflow-hidden pt-16">
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
          <div className="absolute inset-0 mix-blend-multiply" style={{ background: HERO_GRADIENT }} />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(15,26,21,0.88) 0%, rgba(15,26,21,0.35) 55%, rgba(15,26,21,0.15) 100%)" }}
          />
        </div>

        <div className="relative mx-auto max-w-3xl px-6 pt-10 text-center lg:px-12">
          <h1 className="font-display text-4xl leading-[1.1] font-medium tracking-tight text-balance text-white sm:text-6xl">
            Everything your school needs, in one place.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-balance text-white/80">
            Attendance, grading, fees, live classes, and parent communication —
            while your M-Pesa till, your SMS sender ID, and your logo stay
            exactly yours.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="rounded-full" render={<Link href="/login">Sign in</Link>} />
            <Button size="lg" variant="outline" className="rounded-full border-2 border-white/30 bg-transparent text-white hover:bg-white/10" render={<Link href="/features">See what&apos;s inside</Link>} />
          </div>
        </div>
      </section>

      {/* What it does — numbered cards, no icons */}
      <section className="relative px-6 py-28 lg:px-12" style={{ backgroundColor: "#fdfaf5" }}>
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">What it does</p>
          <h2 className="font-display mt-4 max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
            Everything your school already pays six different apps for.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.n}
                className="rounded-2xl p-7 transition-transform hover:-translate-y-1"
                style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}0f` }}
              >
                <span
                  className="font-display flex size-10 items-center justify-center rounded-full border text-sm"
                  style={{ borderColor: `${INK}26`, color: INK }}
                >
                  {f.n}
                </span>
                <h3 className="mt-4 font-medium" style={{ color: INK }}>{f.title}</h3>
                <p className="mt-1.5 text-sm" style={{ color: `${INK}99` }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for — accent-bar cards, no icons */}
      <section className="relative px-6 py-28 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Who it&apos;s for</p>
          <h2 className="font-display mt-4 max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
            Everyone in your school, one login each.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role) => (
              <div
                key={role.title}
                className="overflow-hidden rounded-2xl pl-5"
                style={{ backgroundColor: SURFACE, boxShadow: SHADOW, borderLeft: "3px solid #1f6e52" }}
              >
                <div className="py-6 pr-5">
                  <h3 className="font-display text-xl" style={{ color: INK }}>{role.title}</h3>
                  <p className="mt-2 text-sm" style={{ color: `${INK}99` }}>{role.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why iSchool — dark band, large pull-quote statements, no icons */}
      <section className="relative overflow-hidden py-24" style={{ backgroundColor: DARK }}>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Why iSchool</p>
          <h2 className="font-display mt-4 max-w-xl text-3xl font-medium tracking-tight text-balance text-white sm:text-4xl">
            Not a copy-paste school app.
          </h2>
          <div className="mt-12 flex flex-col gap-5">
            {DIFFERENTIATORS.map((d) => (
              <div
                key={d.n}
                className="relative overflow-hidden rounded-2xl p-8 sm:p-10"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span
                  aria-hidden
                  className="font-display pointer-events-none absolute -top-8 right-6 text-9xl leading-none font-medium text-white select-none"
                  style={{ opacity: 0.05 }}
                >
                  {d.n}
                </span>
                <p className="relative text-xs font-semibold tracking-[0.2em] text-primary uppercase">{d.label}</p>
                <p className="font-display relative mt-4 max-w-2xl text-2xl text-balance text-white sm:text-3xl">
                  {d.statement}
                </p>
                <p className="relative mt-4 max-w-xl text-white/60">{d.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA />
    </>
  );
}
