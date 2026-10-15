import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AtmosphereBlob, INK, SURFACE, SHADOW } from "@/components/marketing/chrome";
import heroPhoto from "../../../public/hero/classroom.jpg";

const EXPLORE = [
  {
    href: "/features",
    label: "What it does",
    description: "Attendance, fees, live classes, exams, SMS — everything, actually connected.",
  },
  {
    href: "/for-schools",
    label: "Who it's for",
    description: "Administrators, teachers, parents, and students, each with their own login.",
  },
  {
    href: "/why",
    label: "Why iSchool",
    description: "Your money, your brand, built for how Kenyan schools actually run.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden pt-32 lg:pt-40">
        <AtmosphereBlob className="-right-20 -top-10 size-[28rem] opacity-50" />
        <AtmosphereBlob className="-left-32 bottom-0 size-[24rem] opacity-40" color="#5b8fb0" />

        <div className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:px-12 lg:pb-32">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
              iSchool — school management
            </p>
            <h1 className="font-display mt-5 text-5xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl">
              Run your school.
              <br />
              Keep your money, your brand.
            </h1>
            <p className="mt-6 max-w-md text-lg text-balance" style={{ color: `${INK}99` }}>
              Attendance, grading, fees, live classes, and parent communication —
              while your M-Pesa till, your SMS sender ID, and your logo stay
              exactly yours.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Button size="lg" render={<Link href="/login">Sign in</Link>} />
              <Link href="/features" className="text-sm font-medium underline-offset-4 hover:underline">
                See what&apos;s inside →
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              className="absolute inset-0 rounded-[2rem] bg-primary"
              style={{ transform: "rotate(-3deg) translate(14px, 10px)" }}
            />
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-[2rem]"
              style={{ transform: "rotate(1.5deg)", boxShadow: SHADOW }}
            >
              <Image
                src={heroPhoto}
                alt="A teacher and students at a classroom whiteboard"
                fill
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover grayscale contrast-110"
                style={{ objectPosition: "70% 35%" }}
                priority
              />
              <div
                className="absolute inset-0 mix-blend-multiply"
                style={{ background: `linear-gradient(160deg, transparent 40%, ${INK}99 100%)` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-6 pb-28 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-3">
          {EXPLORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl p-7 transition-transform hover:-translate-y-1"
              style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}14` }}
            >
              <h2 className="font-display text-xl">{item.label}</h2>
              <p className="mt-2 text-sm" style={{ color: `${INK}99` }}>{item.description}</p>
              <span className="mt-4 inline-block text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
