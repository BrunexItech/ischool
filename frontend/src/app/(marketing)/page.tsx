import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ClosingCTA, DARK, Eyebrow, INK, MUTED, BORDER, SURFACE, SHADOW, SHADOW_LG } from "@/components/marketing/chrome";
import { FadeIn } from "@/components/marketing/fade-in";
import studentsShot from "../../../public/screenshots/students.png";
import classroomPhoto from "../../../public/hero/classroom.jpg";
import teacherLaptopPhoto from "../../../public/photos/teacher-laptop.jpg";
import schoolyardPhoto from "../../../public/photos/schoolyard.jpg";

const GALLERY = [
  { src: classroomPhoto, alt: "A teacher and students at a classroom whiteboard" },
  { src: teacherLaptopPhoto, alt: "A teacher preparing a lesson on her laptop" },
  { src: schoolyardPhoto, alt: "Students gathered outside their school" },
];

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
      {/* Hero — full-bleed video, light color wash using the ViralBlast accent palette */}
      <section className="relative flex min-h-[100svh] items-end overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/hero/hero-video-poster.jpg"
            className="h-full w-full object-cover"
          >
            <source src="/hero/hero-video.mp4" type="video/mp4" />
          </video>
          {/* Vivid color wash — the exact blue/cyan/green accents from the reference file, screen-blended to stay light */}
          <div
            className="absolute inset-0 mix-blend-screen"
            style={{ background: "linear-gradient(120deg, #4f7aff40 0%, #00d4ff30 45%, #00e67625 100%)" }}
          />
          {/* Light scrim so text at the bottom reads on a near-white surface */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, #f7f8fc 0%, #f7f8fce6 28%, #f7f8fc80 50%, transparent 78%)" }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-6 pt-32 pb-16 lg:px-12 lg:pb-24">
          <FadeIn>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: BORDER, backgroundColor: SURFACE, color: INK, boxShadow: SHADOW }}
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ backgroundColor: "#00e676" }} />
                <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: "#00e676" }} />
              </span>
              The complete school management platform
            </span>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl" style={{ color: INK }}>
              Every part of your school.
              <br />
              One connected system.
            </h1>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mt-6 max-w-xl text-lg text-balance" style={{ color: MUTED }}>
              Attendance, academics, fees, and communication — brought
              together in one platform, so your team stops switching
              between six different tools.
            </p>
          </FadeIn>
          <FadeIn delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="rounded-lg bg-[image:linear-gradient(135deg,#4f7aff,#2a58d5)] text-white shadow-[0_16px_32px_-14px_rgba(79,122,255,0.55)] hover:brightness-110"
                render={<Link href="/login">Sign in</Link>}
              />
              <Button
                size="lg"
                variant="outline"
                className="rounded-lg border-2 bg-white/70 backdrop-blur-sm"
                style={{ borderColor: "#00d4ff", color: INK }}
                render={<Link href="#platform">Explore the platform</Link>}
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Photo gallery — real school moments, for liveliness */}
      <section className="px-6 py-16 lg:px-12" style={{ backgroundColor: SURFACE }}>
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-3">
          {GALLERY.map((g, i) => (
            <FadeIn key={g.alt} delay={i * 0.08}>
              <div className="aspect-[4/5] overflow-hidden rounded-xl" style={{ boxShadow: SHADOW, border: `1px solid ${BORDER}` }}>
                <Image src={g.src} alt={g.alt} className="h-full w-full object-cover" />
              </div>
            </FadeIn>
          ))}
        </div>
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
