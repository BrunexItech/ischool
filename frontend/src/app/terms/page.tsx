import Link from "next/link";
import { GraduationCap } from "lucide-react";

export const metadata = { title: "Terms of Service — iSchool" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4.5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">iSchool</span>
        </Link>
        <Link href="/login" className="text-sm text-primary hover:underline">Sign in</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: [Date] · [Your Company Legal Name] (&quot;iSchool&quot;, &quot;we&quot;, &quot;us&quot;)</p>

        <Section title="1. Agreement">
          <p>
            These terms govern use of iSchool by a school, college, or other institution
            (&quot;the School&quot;) and its authorized users (staff, teachers, students, and
            parents/guardians). By creating an account or using iSchool, the School and each user
            agree to these terms.
          </p>
        </Section>

        <Section title="2. What iSchool provides">
          <p>
            A platform for managing school operations: student and staff records, attendance, results,
            fee tracking, communication, and live online classes. Which modules are active for a School
            is controlled by that School&apos;s administrator and/or iSchool&apos;s platform team.
          </p>
        </Section>

        <Section title="3. Accounts and responsibilities">
          <ul className="list-disc space-y-1 pl-5">
            <li>The School&apos;s administrator is responsible for who gets an account, what role they hold, and for obtaining any consent required to create accounts for students or parents/guardians.</li>
            <li>Each user is responsible for keeping their own login credentials confidential and for activity under their account.</li>
            <li>Accounts should not be shared between people.</li>
          </ul>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use iSchool to store or share content you don&apos;t have the right to, or that is unlawful, harassing, or harmful.</li>
            <li>Attempt to access another school&apos;s data, or another user&apos;s account, without authorization.</li>
            <li>Interfere with or disrupt the service (e.g. attempting to overload it, probing for vulnerabilities without authorization).</li>
            <li>Record or redistribute a live class without the consent of the people in it, beyond what the School has authorized.</li>
          </ul>
        </Section>

        <Section title="5. Fees and payment">
          <p>
            [Describe your pricing model here once finalized — e.g. per-student subscription, flat
            per-school fee, free tier limits.] Fees, if any, are described separately at the time a
            School signs up.
          </p>
        </Section>

        <Section title="6. Data ownership">
          <p>
            The School owns the data it puts into iSchool. We process it only to provide the service,
            as described in our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            If a School stops using iSchool, it may request an export of its data within [30] days of
            cancellation, after which it may be deleted.
          </p>
        </Section>

        <Section title="7. Service availability">
          <p>
            We aim to keep iSchool available and reliable, but we don&apos;t guarantee uninterrupted
            service. We&apos;ll do our best to give notice of planned maintenance that affects
            availability.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            iSchool is provided &quot;as is.&quot; To the fullest extent permitted by law, we are not
            liable for indirect, incidental, or consequential damages arising from use of the service.
            [This section should be reviewed by a lawyer before publishing — liability limitations are
            jurisdiction-specific.]
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            A School may stop using iSchool at any time. We may suspend or terminate an account that
            violates these terms, or where required by law.
          </p>
        </Section>

        <Section title="10. Governing law">
          <p>These terms are governed by the laws of [Jurisdiction, e.g. Kenya].</p>
        </Section>

        <Section title="11. Contact">
          <p>[Your Company Legal Name], [Registered Address]. [support@yourcompany.example].</p>
        </Section>
      </main>
    </div>
  );
}
