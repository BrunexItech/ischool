import { BORDER, ClosingCTA, INK, MUTED, PageIntro, SURFACE, SHADOW } from "@/components/marketing/chrome";

const FEATURES = [
  { n: "01", title: "Attendance & results", description: "Daily attendance and graded results, tracked by class, subject, and term." },
  { n: "02", title: "Fees & payments", description: "Invoices and balances that settle by M-Pesa or card — straight into your own account." },
  { n: "03", title: "Live online classes", description: "Schedule a lesson, share a link, and teach from inside the same dashboard." },
  { n: "04", title: "Announcements & bulk SMS", description: "Reach every parent by app and SMS at once, from your own sender ID." },
  { n: "05", title: "Online exams", description: "Timed, auto-graded exams with resume-on-reload — no lost answers." },
  { n: "06", title: "Multi-branch", description: "One login for every campus, each with its own staff, classes, and books." },
];

export default function FeaturesPage() {
  return (
    <>
      <PageIntro
        eyebrow="What it does"
        title="Everything your school already pays six different apps for."
        description="One system, one login, one source of truth for your whole school."
      />
      <section className="relative mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className="rounded-xl p-7 transition-transform hover:-translate-y-1"
              style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${BORDER}` }}
            >
              <span className="flex size-10 items-center justify-center rounded-full border text-sm font-medium" style={{ borderColor: BORDER, color: INK }}>
                {f.n}
              </span>
              <h3 className="mt-4 font-semibold" style={{ color: INK }}>{f.title}</h3>
              <p className="mt-1.5 text-sm" style={{ color: MUTED }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
