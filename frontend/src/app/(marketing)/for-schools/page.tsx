import { AtmosphereBlob, ClosingCTA, INK, PageIntro, SURFACE, SHADOW } from "@/components/marketing/chrome";

const ROLES = [
  { title: "Administrators", description: "Run every branch, staff list, and fee structure from one console." },
  { title: "Teachers", description: "Mark attendance, grade exams, and plan a whole term's lessons." },
  { title: "Parents & guardians", description: "See results, pay fees, and get updates the moment they happen." },
  { title: "Students", description: "Check results, join live classes, and sit exams online." },
];

export default function ForSchoolsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <AtmosphereBlob className="-left-24 top-10 size-[26rem] opacity-40" color="#5b8fb0" />
        <PageIntro eyebrow="Who it's for" title="Everyone in your school, one login each." />
        <div className="relative mx-auto grid max-w-7xl gap-5 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
          {ROLES.map((role) => (
            <div
              key={role.title}
              className="rounded-2xl p-7"
              style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}14` }}
            >
              <h3 className="font-display text-2xl">{role.title}</h3>
              <p className="mt-3 text-sm" style={{ color: `${INK}99` }}>{role.description}</p>
            </div>
          ))}
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
