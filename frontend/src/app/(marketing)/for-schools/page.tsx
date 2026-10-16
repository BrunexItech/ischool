import { ClosingCTA, INK, MUTED, PageIntro, SURFACE, SHADOW } from "@/components/marketing/chrome";

const ROLES = [
  { title: "Administrators", description: "Run every branch, staff list, and fee structure from one console." },
  { title: "Teachers", description: "Mark attendance, grade exams, and plan a whole term's lessons." },
  { title: "Parents & guardians", description: "See results, pay fees, and get updates the moment they happen." },
  { title: "Students", description: "Check results, join live classes, and sit exams online." },
];

export default function ForSchoolsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Who it's for"
        title="Everyone in your school, one login each."
        description="A different view for every role — the same source of truth underneath."
      />
      <section className="relative mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => (
            <div
              key={role.title}
              className="overflow-hidden rounded-xl pl-5"
              style={{ backgroundColor: SURFACE, boxShadow: SHADOW, borderLeft: "3px solid #0d9488" }}
            >
              <div className="py-6 pr-5">
                <h3 className="font-semibold" style={{ color: INK }}>{role.title}</h3>
                <p className="mt-2 text-sm" style={{ color: MUTED }}>{role.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
