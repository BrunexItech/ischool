import { ClosingCTA, Eyebrow, INK, MUTED, PageIntro } from "@/components/marketing/chrome";

const DIFFERENTIATORS = [
  {
    n: "01",
    label: "Money",
    statement: "Your money stays yours",
    description:
      "Connect your own M-Pesa till, Pesapal account, and SMS sender ID. We never touch your school's funds or hold your comms credentials — payments and messages go out under your name.",
  },
  {
    n: "02",
    label: "Brand",
    statement: "Actually white-labeled",
    description:
      "Your logo, your colors, and — if you bring one — your own domain. Parents and staff see your school's brand, not ours.",
  },
  {
    n: "03",
    label: "Fit",
    statement: "Built for how Kenyan schools run",
    description:
      "M-Pesa and card payments, SMS that reaches feature phones, and multi-branch support from day one — not bolted on as an afterthought.",
  },
];

export default function WhyPage() {
  return (
    <>
      <PageIntro
        eyebrow="Why iSchool"
        title="Not a copy-paste school app."
        description="A few things most school platforms don't do — that we built in from the start."
      />
      <section className="relative mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <div className="flex flex-col gap-5">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.n} className="relative overflow-hidden rounded-xl p-8 sm:p-10" style={{ backgroundColor: "#eef1f8" }}>
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
          ))}
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
