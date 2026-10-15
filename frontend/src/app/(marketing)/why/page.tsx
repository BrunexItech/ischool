import { ShieldCheck, Palette, Building2 } from "lucide-react";
import { ClosingCTA, IconBadge, INK, PageIntro, SURFACE, SHADOW } from "@/components/marketing/chrome";

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

export default function WhyPage() {
  return (
    <>
      <PageIntro
        eyebrow="Why iSchool"
        title="Not a copy-paste school app."
        description="A few things most school platforms don't do — that we built in from the start."
      />
      <section className="relative mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <div className="grid gap-5 lg:grid-cols-3">
          {DIFFERENTIATORS.map((d, i) => (
            <div
              key={d.title}
              className="rounded-2xl p-7"
              style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}0f` }}
            >
              <IconBadge icon={d.icon} index={i} />
              <h3 className="mt-4 font-medium" style={{ color: INK }}>{d.title}</h3>
              <p className="mt-2 text-sm" style={{ color: `${INK}99` }}>{d.description}</p>
            </div>
          ))}
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
