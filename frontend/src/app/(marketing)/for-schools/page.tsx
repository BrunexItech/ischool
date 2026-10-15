import { Building2, BookOpen, Heart, GraduationCap } from "lucide-react";
import { ClosingCTA, IconBadge, INK, PageIntro, SURFACE, SHADOW } from "@/components/marketing/chrome";

const ROLES = [
  { icon: Building2, title: "Administrators", description: "Run every branch, staff list, and fee structure from one console." },
  { icon: BookOpen, title: "Teachers", description: "Mark attendance, grade exams, and plan a whole term's lessons." },
  { icon: Heart, title: "Parents & guardians", description: "See results, pay fees, and get updates the moment they happen." },
  { icon: GraduationCap, title: "Students", description: "Check results, join live classes, and sit exams online." },
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
          {ROLES.map((role, i) => (
            <div
              key={role.title}
              className="rounded-2xl p-6"
              style={{ backgroundColor: SURFACE, boxShadow: SHADOW, border: `1px solid ${INK}0f` }}
            >
              <IconBadge icon={role.icon} index={i} />
              <h3 className="mt-4 font-medium" style={{ color: INK }}>{role.title}</h3>
              <p className="mt-1.5 text-sm" style={{ color: `${INK}99` }}>{role.description}</p>
            </div>
          ))}
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
