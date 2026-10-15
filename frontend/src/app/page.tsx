import Link from "next/link";
import Image from "next/image";
import {
  GraduationCap,
  ClipboardCheck,
  Wallet,
  Video,
  MessageSquareText,
  FileCheck2,
  Building2,
  Users,
  BookOpen,
  Heart,
  ShieldCheck,
  Palette,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroPhoto from "../../public/hero/classroom.jpg";

const TRUST_CHIPS = [
  "M-Pesa & card payments",
  "Bulk SMS",
  "Live online classes",
  "Multi-branch",
];

const ROLES = [
  {
    icon: Building2,
    title: "Administrators",
    description: "Run every branch, staff, and fee structure from one console.",
  },
  {
    icon: BookOpen,
    title: "Teachers",
    description: "Mark attendance, grade exams, and plan a whole term's lessons.",
  },
  {
    icon: Heart,
    title: "Parents & guardians",
    description: "See results, pay fees, and get updates the moment they happen.",
  },
  {
    icon: GraduationCap,
    title: "Students",
    description: "Check results, join live classes, and sit exams online.",
  },
];

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: "Attendance & results",
    description: "Daily attendance and graded results, tracked by class, subject, and term.",
  },
  {
    icon: Wallet,
    title: "Fees & payments",
    description: "Invoices and balances that settle by M-Pesa or card — straight into your own account.",
  },
  {
    icon: Video,
    title: "Live online classes",
    description: "Schedule a lesson, share a link, and teach from inside the same dashboard.",
  },
  {
    icon: MessageSquareText,
    title: "Announcements & bulk SMS",
    description: "Reach every parent by app and SMS at once, from your own sender ID.",
  },
  {
    icon: FileCheck2,
    title: "Online exams",
    description: "Timed, auto-graded exams with resume-on-reload — no lost answers.",
  },
  {
    icon: Building2,
    title: "Multi-branch",
    description: "One login for every campus, each with its own staff, classes, and books.",
  },
];

const DIFFERENTIATORS = [
  {
    icon: ShieldCheck,
    title: "Your money stays yours",
    description:
      "Connect your own M-Pesa till, Pesapal account, and SMS sender ID. We never touch your school's funds or hold your comms credentials — payments and messages go out under your name.",
  },
  {
    icon: Palette,
    title: "Actually white-labeled",
    description:
      "Your logo, your colors, and — if you bring one — your own domain. Parents and staff see your school's brand, not ours.",
  },
  {
    icon: Building2,
    title: "Built for how Kenyan schools run",
    description:
      "M-Pesa and card payments, SMS that reaches feature phones, and multi-branch support from day one — not bolted on as an afterthought.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-12">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-4.5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">iSchool</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#roles" className="hover:text-foreground">For your school</a>
            <a href="#why" className="hover:text-foreground">Why iSchool</a>
          </nav>
          <Button variant="ghost" render={<Link href="/login">Sign in</Link>} />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 size-[32rem] rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24 lg:px-12">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium tracking-wide text-accent-foreground uppercase">
                Built for Kenyan schools &amp; colleges
              </span>
              <h1 className="font-display mt-5 text-5xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl">
                Run your school.
                <br />
                Keep your money, your brand.
              </h1>
              <p className="mt-6 max-w-lg text-lg text-muted-foreground text-balance">
                iSchool handles attendance, grading, fees, live classes, and parent
                communication — while your M-Pesa till, your SMS sender ID, and your
                logo stay exactly yours.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" render={<Link href="/login">Sign in <ArrowRight /></Link>} />
                <Button size="lg" variant="outline" render={<a href="#features">See what&apos;s included</a>} />
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {TRUST_CHIPS.map((chip) => (
                  <li key={chip} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-primary" />
                    {chip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-black/5">
                <Image
                  src={heroPhoto}
                  alt="A teacher and students working together at a classroom whiteboard"
                  fill
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="object-cover"
                  style={{ objectPosition: "70% 35%" }}
                  priority
                />
              </div>

              <div className="absolute -left-4 top-8 flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:-left-8">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="size-4.5" />
                </div>
                <div className="text-sm">
                  <p className="font-medium">Attendance marked</p>
                  <p className="text-xs text-muted-foreground">Grade 6B · 9:02 AM</p>
                </div>
              </div>

              <div className="absolute -right-4 bottom-10 flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:-right-8">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Wallet className="size-4.5" />
                </div>
                <div className="text-sm">
                  <p className="font-medium">Fee payment received</p>
                  <p className="text-xs text-muted-foreground">KES 15,000 via M-Pesa</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="border-y border-border/60 bg-accent/30">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-12">
            <h2 className="font-display max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Built for everyone in your school
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((role) => (
                <div key={role.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <role.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-medium">{role.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{role.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Everything, actually connected
            </h2>
            <p className="mt-3 text-lg text-muted-foreground text-balance">
              Not six different tools bolted together — one system, one login,
              one source of truth for your whole school.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why iSchool */}
        <section id="why" className="border-t border-border/60 bg-accent/30">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                Not a copy-paste school app
              </h2>
              <p className="mt-3 text-lg text-muted-foreground text-balance">
                A few things most school platforms don&apos;t do — that we built in from the start.
              </p>
            </div>
            <div className="mt-10 grid gap-8 lg:grid-cols-3">
              {DIFFERENTIATORS.map((d) => (
                <div key={d.title}>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <d.icon className="size-5.5" />
                  </div>
                  <h3 className="mt-4 font-medium">{d.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-20 text-center lg:px-12">
            <Users className="size-9 text-sidebar-primary" />
            <h2 className="font-display max-w-lg text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Ready to bring your school online?
            </h2>
            <p className="max-w-md text-sidebar-foreground/70">
              If your school is already set up on iSchool, sign in below. New
              school? Ask your administrator to get your account provisioned.
            </p>
            <Button size="lg" render={<Link href="/login">Sign in <ArrowRight /></Link>} />
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t px-6 py-6 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} iSchool</span>
        <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-foreground hover:underline">Terms of Service</Link>
      </footer>
    </div>
  );
}
