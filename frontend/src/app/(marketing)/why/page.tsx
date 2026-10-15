import { AtmosphereBlob, ClosingCTA, INK, PageIntro, SURFACE, SHADOW } from "@/components/marketing/chrome";

const DIFFERENTIATORS = [
  {
    n: "01",
    label: "Money",
    statement: "Your M-Pesa till. Your Pesapal account. Your SMS sender ID.",
    description:
      "Connect your own accounts and keep them. We never touch your school's funds or hold your comms credentials — payments and messages go out under your name, not ours.",
  },
  {
    n: "02",
    label: "Brand",
    statement: "Your logo, your colors, your domain.",
    description:
      "Parents and staff see your school's identity end to end — not a platform wearing your logo as an afterthought.",
  },
  {
    n: "03",
    label: "Fit",
    statement: "Built for how Kenyan schools actually run.",
    description:
      "M-Pesa and card payments, SMS that reaches feature phones, multi-branch support from day one — not bolted on after the fact.",
  },
];

export default function WhyPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <AtmosphereBlob className="-right-24 top-20 size-[26rem] opacity-50" />
        <PageIntro eyebrow="Why iSchool" title="Not a copy-paste school app." />
        <div className="relative mx-auto max-w-7xl px-6 py-12 lg:px-12">
          <div className="flex flex-col gap-6">
            {DIFFERENTIATORS.map((d) => (
              <div
                key={d.n}
                className="relative overflow-hidden rounded-[2rem] p-8 sm:p-10"
                style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}14` }}
              >
                <span
                  aria-hidden
                  className="font-display pointer-events-none absolute -top-10 right-4 text-[11rem] leading-none font-medium select-none"
                  style={{ color: `${INK}0d` }}
                >
                  {d.n}
                </span>
                <p className="relative text-xs font-medium tracking-[0.2em] text-primary uppercase">
                  {d.n} — {d.label}
                </p>
                <p className="font-display relative mt-4 max-w-2xl text-2xl text-balance sm:text-3xl">
                  {d.statement}
                </p>
                <p className="relative mt-4 max-w-xl" style={{ color: `${INK}99` }}>{d.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
