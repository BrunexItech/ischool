import Link from "next/link";
import Image from "next/image";
import {
  ClipboardCheck,
  Wallet,
  Video,
  MessageSquareText,
  FileCheck2,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClosingCTA, DARK, HERO_GRADIENT, IconBadge, INK, SURFACE, SHADOW } from "@/components/marketing/chrome";
import overviewShot from "../../../public/screenshots/overview.png";
import studentsShot from "../../../public/screenshots/students.png";
import heroPhoto from "../../../public/hero/classroom.jpg";

const FEATURES = [
  { icon: ClipboardCheck, title: "Attendance & results", description: "Daily attendance and graded results, tracked by class, subject, and term." },
  { icon: Wallet, title: "Fees & payments", description: "Invoices and balances that settle by M-Pesa or card — straight into your own account." },
  { icon: Video, title: "Live online classes", description: "Schedule a lesson, share a link, and teach from inside the same dashboard." },
  { icon: MessageSquareText, title: "Announcements & bulk SMS", description: "Reach every parent by app and SMS at once, from your own sender ID." },
  { icon: FileCheck2, title: "Online exams", description: "Timed, auto-graded exams with resume-on-reload — no lost answers." },
  { icon: Building2, title: "Multi-branch", description: "One login for every campus, each with its own staff, classes, and books." },
];

const CHECKLIST = [
  "Enroll students and link guardians in minutes",
  "Mark attendance by class, every single day",
  "Keep fee balances and M-Pesa payments in sync",
  "Give every parent portal access, built in",
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-28 lg:px-12">
          <div>
            <h1 className="font-display text-4xl leading-[1.1] font-medium tracking-tight text-balance text-white sm:text-5xl">
              Everything your school needs, in one place.
            </h1>
            <p className="mt-5 max-w-md text-lg text-balance text-white/75">
              Attendance, grading, fees, live classes, and parent communication —
              while your M-Pesa till, your SMS sender ID, and your logo stay
              exactly yours.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" className="rounded-full" render={<Link href="/login">Sign in</Link>} />
              <Button size="lg" variant="outline" className="rounded-full border-2 border-white/30 bg-transparent text-white hover:bg-white/10" render={<Link href="/features">See what&apos;s inside</Link>} />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div
              className="absolute inset-0 rounded-[2rem]"
              style={{ backgroundColor: "#efc789", transform: "rotate(-3deg) translate(12px, 10px)" }}
            />
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-[2rem]"
              style={{ transform: "rotate(1.5deg)", boxShadow: SHADOW }}
            >
              <Image
                src={heroPhoto}
                alt="A teacher and students at a classroom whiteboard"
                fill
                sizes="(min-width: 1024px) 36vw, 80vw"
                className="object-cover grayscale contrast-110"
                style={{ objectPosition: "70% 35%" }}
                priority
              />
              <div
                className="absolute inset-0 mix-blend-multiply"
                style={{ background: "linear-gradient(160deg, transparent 35%, #0f2a2199 100%)" }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-6 py-20 lg:px-12" style={{ backgroundColor: "#fdfaf5" }}>
        <p className="text-center text-xs font-semibold tracking-[0.2em] text-primary uppercase">See it in action</p>
        <h2 className="font-display mt-3 text-center text-2xl font-medium tracking-tight text-balance sm:text-3xl" style={{ color: INK }}>
          The actual dashboard — not a mockup.
        </h2>
        <div
          className="relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-2xl"
          style={{ boxShadow: SHADOW, border: `1px solid ${INK}14` }}
        >
          <Image src={overviewShot} alt="The iSchool dashboard overview screen" className="w-full" />
        </div>
      </section>

      {/* Solutions — icon badge grid */}
      <section className="relative px-6 py-28 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">What it does</p>
          <h2 className="font-display mt-4 max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl" style={{ color: INK }}>
            Everything your school already pays six different apps for.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="rounded-2xl p-6"
                style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}0f` }}
              >
                <IconBadge icon={f.icon} index={i} />
                <h3 className="mt-4 font-medium" style={{ color: INK }}>{f.title}</h3>
                <p className="mt-1.5 text-sm" style={{ color: `${INK}99` }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark feature band — reuses the real product sidebar color */}
      <section className="relative overflow-hidden py-24" style={{ backgroundColor: DARK }}>
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:px-12">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Students</p>
            <h2 className="font-display mt-4 text-3xl font-medium tracking-tight text-balance text-white sm:text-4xl">
              Every student record, always current.
            </h2>
            <p className="mt-4 max-w-md text-white/60">
              Enroll once, and the record follows the student through
              attendance, results, fees, and the parent portal.
            </p>
            <ul className="mt-7 flex flex-col gap-3">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-white/80">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
            <Image src={studentsShot} alt="The iSchool students list screen" className="w-full" />
          </div>
        </div>
      </section>

      <ClosingCTA />
    </>
  );
}
