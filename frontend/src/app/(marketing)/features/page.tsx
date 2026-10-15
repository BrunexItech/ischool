import { AtmosphereBlob, ClosingCTA, INK, PageIntro, SURFACE, SHADOW } from "@/components/marketing/chrome";

const FEATURES = [
  {
    n: "01",
    title: "Attendance & results",
    description: "Daily attendance and graded results, tracked by class, subject, and term.",
  },
  {
    n: "02",
    title: "Fees & payments",
    description: "Invoices and balances that settle by M-Pesa or card — straight into your own account.",
  },
  {
    n: "03",
    title: "Live online classes",
    description: "Schedule a lesson, share a link, and teach from inside the same dashboard.",
  },
  {
    n: "04",
    title: "Announcements & bulk SMS",
    description: "Reach every parent by app and SMS at once, from your own sender ID.",
  },
  {
    n: "05",
    title: "Online exams",
    description: "Timed, auto-graded exams with resume-on-reload — no lost answers.",
  },
  {
    n: "06",
    title: "Multi-branch",
    description: "One login for every campus, each with its own staff, classes, and books.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <AtmosphereBlob className="-right-20 -top-10 size-[26rem] opacity-50" />
        <PageIntro
          eyebrow="What it does"
          title="Everything your school already pays six different apps for."
        />
        <div className="relative mx-auto grid max-w-7xl gap-5 px-6 py-12 sm:grid-cols-2 lg:px-12">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className="rounded-2xl p-7"
              style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}14` }}
            >
              <span className="font-display text-2xl text-primary">{f.n}</span>
              <h3 className="mt-3 text-lg font-medium">{f.title}</h3>
              <p className="mt-1.5" style={{ color: `${INK}99` }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
