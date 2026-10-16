import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ClosingCTA, DARK, Eyebrow, INK, MUTED, BORDER, SURFACE, SHADOW, SHADOW_LG } from "@/components/marketing/chrome";
import { FadeIn } from "@/components/marketing/fade-in";
import overviewShot from "../../../public/screenshots/overview.png";
import studentsShot from "../../../public/screenshots/students.png";

const STATS = [
  { value: "6", label: "Connected modules" },
  { value: "M-Pesa + Card", label: "Payments, your account" },
  { value: "100%", label: "White-labeled" },
  { value: "Multi-branch", label: "One login, every campus" },
];

const CATEGORIES = [
  {
    title: "Academics",
    description: "Everything a teacher needs to run a classroom and a term.",
    items: ["Attendance", "Results & report cards", "Online exams", "Lesson plans", "Academic terms", "Teaching assignments"],
    span: "lg:col-span-2",
  },
  {
    title: "Administration",
    description: "Student and staff records, organized by branch.",
    items: ["Student records", "Staff records", "Classes", "Multi-branch"],
    span: "",
  },
  {
    title: "Finance",
    description: "Fees and payments that settle to your own account.",
    items: ["Fee invoicing & balances", "M-Pesa & card payments", "Finance reports"],
    span: "",
  },
  {
    title: "Communication",
    description: "Reach every parent, from your own sender ID.",
    items: ["Announcements", "Bulk SMS", "Parent & student portals"],
    span: "",
  },
  {
    title: "Operations",
    description: "The day-to-day logistics of running a school.",
    items: ["Transport & routes", "Meals", "Pickup / drop-off logs", "Live online classes"],
    span: "lg:col-span-2",
  },
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

const FAQS = [
  { q: "Does iSchool take a cut of my school's fees?", a: "No. You connect your own M-Pesa till or Pesapal account, and payments settle directly to you — we never touch your school's money." },
  { q: "Can we use our own SMS sender ID?", a: "Yes. Bulk SMS goes out from your own MobileSasa account and sender ID, not a shared one." },
  { q: "Is the platform actually white-labeled?", a: "Yes. Your logo and brand colors appear throughout the dashboard and portal, for every role, on every screen." },
  { q: "Can we manage multiple campuses from one account?", a: "Yes. Multi-branch support is built in — one login covers every campus, each with its own staff, classes, and records." },
  { q: "What if we're not ready to switch everything at once?", a: "Each module can be turned on independently, so you can start with attendance and fees, for example, and add the rest when you're ready." },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-40 lg:pt-28" style={{ backgroundColor: DARK }}>
        <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-12">
          <FadeIn>
            <Eyebrow dark>The complete school management platform</Eyebrow>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-balance text-white sm:text-6xl lg:text-7xl">
              Every part of your school.
              <br />
              One connected system.
            </h1>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-balance text-white/60">
              Attendance, academics, fees, and communication — brought
              together in one platform, so your team stops switching between
              six different tools.
            </p>
          </FadeIn>
          <FadeIn delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" className="rounded-lg" render={<Link href="/login">Sign in</Link>} />
              <Button size="lg" variant="outline" className="rounded-lg border-white/20 bg-transparent text-white hover:bg-white/10" render={<Link href="#platform">Explore the platform</Link>} />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Layered product showcase, bleeding up into the dark hero */}
      <section className="relative px-6 lg:px-12" style={{ marginTop: "-9rem" }}>
        <FadeIn>
          <div className="relative mx-auto max-w-5xl">
            <div
              className="absolute -top-5 -right-5 hidden w-[58%] overflow-hidden rounded-xl sm:block lg:-top-8 lg:-right-10"
              style={{ boxShadow: SHADOW, border: `1px solid ${BORDER}`, transform: "rotate(3deg)" }}
            >
              <Image src={studentsShot} alt="" aria-hidden className="w-full opacity-95" />
            </div>
            <div className="relative overflow-hidden rounded-xl" style={{ boxShadow: SHADOW_LG, border: `1px solid ${BORDER}` }}>
              <Image src={overviewShot} alt="The iSchool dashboard overview screen" className="w-full" priority />
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Stat strip */}
      <section className="border-b px-6 py-16 lg:px-12" style={{ borderColor: BORDER, backgroundColor: SURFACE }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: INK }}>{s.value}</div>
              <div className="mt-1.5 text-sm" style={{ color: MUTED }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Split-screen: the problem, the fix */}
      <section className="px-6 py-24 lg:px-12" style={{ backgroundColor: SURFACE }}>
        <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2">
          <FadeIn>
            <Eyebrow>The problem</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
              Most schools run on six disconnected tools.
            </h2>
            <p className="mt-4 max-w-md" style={{ color: MUTED }}>
              A spreadsheet for attendance. A separate app for fees. SMS sent
              by hand. Results trapped in one teacher&apos;s laptop. None of it
              talks to each other, and nobody has the full picture.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Eyebrow>The fix</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
              iSchool connects it into one system.
            </h2>
            <p className="mt-4 max-w-md" style={{ color: MUTED }}>
              One login for every role. One record per student, followed
              through attendance, results, fees, and the parent portal. One
              place administrators look to understand the whole school.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Platform breadth — asymmetric grid, no icons */}
      <section id="platform" className="px-6 py-24 lg:px-12" style={{ backgroundColor: "#eef1f8" }}>
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <Eyebrow>The platform</Eyebrow>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
              Every operational area, organized and connected.
            </h2>
          </FadeIn>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {CATEGORIES.map((c, i) => (
              <FadeIn key={c.title} delay={i * 0.06} className={c.span}>
                <div className="h-full rounded-xl p-7" style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${BORDER}` }}>
                  <h3 className="text-lg font-semibold" style={{ color: INK }}>{c.title}</h3>
                  <p className="mt-1.5 text-sm" style={{ color: MUTED }}>{c.description}</p>
                  <div className="mt-5 flex flex-wrap gap-x-2 gap-y-1.5 text-sm" style={{ color: INK }}>
                    {c.items.map((item, idx) => (
                      <span key={item} className="flex items-center gap-2">
                        {item}
                        {idx < c.items.length - 1 && <span style={{ color: BORDER }}>·</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Dark product deep-dive */}
      <section className="relative overflow-hidden py-24" style={{ backgroundColor: DARK }}>
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2 lg:px-12">
          <FadeIn>
            <Eyebrow dark>Student records</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
              Every student record, always current.
            </h2>
            <p className="mt-4 max-w-md text-white/60">
              Enroll once, and the record follows the student through
              attendance, results, fees, and the parent portal — no
              re-entering data between systems.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="overflow-hidden rounded-xl" style={{ boxShadow: SHADOW_LG, border: "1px solid rgba(255,255,255,0.1)" }}>
              <Image src={studentsShot} alt="The iSchool students list screen" className="w-full" />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Why iSchool */}
      <section className="px-6 py-24 lg:px-12" style={{ backgroundColor: SURFACE }}>
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <Eyebrow>Why iSchool</Eyebrow>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
              Not a copy-paste school app.
            </h2>
          </FadeIn>
          <div className="mt-12 flex flex-col gap-5">
            {DIFFERENTIATORS.map((d, i) => (
              <FadeIn key={d.n} delay={i * 0.06}>
                <div className="relative overflow-hidden rounded-xl p-8 sm:p-10" style={{ backgroundColor: "#eef1f8" }}>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-8 right-6 text-9xl leading-none font-semibold select-none"
                    style={{ color: INK, opacity: 0.04 }}
                  >
                    {d.n}
                  </span>
                  <Eyebrow>{d.label}</Eyebrow>
                  <p className="relative mt-4 max-w-2xl text-2xl font-medium text-balance sm:text-3xl" style={{ color: INK }}>
                    {d.statement}
                  </p>
                  <p className="relative mt-4 max-w-xl" style={{ color: MUTED }}>{d.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-24 lg:px-12" style={{ backgroundColor: "#eef1f8" }}>
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <Eyebrow>Questions</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
              Frequently asked questions.
            </h2>
          </FadeIn>
          <div className="mt-10 flex flex-col gap-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
                style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium" style={{ color: INK }}>
                  {f.q}
                  <span className="shrink-0 text-xl transition-transform group-open:rotate-45" style={{ color: MUTED }}>+</span>
                </summary>
                <p className="mt-3 text-sm" style={{ color: MUTED }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA />
    </>
  );
}
