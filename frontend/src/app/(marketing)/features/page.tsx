import {
  ClipboardCheck,
  Wallet,
  Video,
  MessageSquareText,
  FileCheck2,
  Building2,
} from "lucide-react";
import { ClosingCTA, IconBadge, INK, PageIntro, SURFACE, SHADOW } from "@/components/marketing/chrome";

const FEATURES = [
  { icon: ClipboardCheck, title: "Attendance & results", description: "Daily attendance and graded results, tracked by class, subject, and term." },
  { icon: Wallet, title: "Fees & payments", description: "Invoices and balances that settle by M-Pesa or card — straight into your own account." },
  { icon: Video, title: "Live online classes", description: "Schedule a lesson, share a link, and teach from inside the same dashboard." },
  { icon: MessageSquareText, title: "Announcements & bulk SMS", description: "Reach every parent by app and SMS at once, from your own sender ID." },
  { icon: FileCheck2, title: "Online exams", description: "Timed, auto-graded exams with resume-on-reload — no lost answers." },
  { icon: Building2, title: "Multi-branch", description: "One login for every campus, each with its own staff, classes, and books." },
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
      </section>
      <ClosingCTA />
    </>
  );
}
