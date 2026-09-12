import Link from "next/link";
import { GraduationCap } from "lucide-react";

export const metadata = { title: "Privacy Policy — iSchool" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
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
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: [Date] · Effective for [Your Company Legal Name] (&quot;iSchool&quot;, &quot;we&quot;, &quot;us&quot;)</p>

        <Section title="1. What this policy covers">
          <p>
            iSchool is a platform schools use to manage attendance, results, fees, communication, and
            live classes. This policy explains what personal data we process on behalf of the schools
            using iSchool (&quot;the School&quot;), why, and what rights students, parents/guardians, and
            staff have over that data.
          </p>
          <p>
            Each school is the data controller for its own students&apos;, parents&apos;, and staff
            data — iSchool acts as a data processor, storing and processing that data only as
            instructed by the School. Questions about a specific student&apos;s data should go to that
            student&apos;s school first.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Account information: name, email, role, and password (stored as a salted hash, never in plain text).</li>
            <li>Student records: admission number, date of birth, gender, class, guardian contact details.</li>
            <li>Academic data: attendance records, grades and results, fee invoices and payment records.</li>
            <li>Communications: announcements and in-app notifications sent through the platform.</li>
            <li>Live class data: video/audio streamed during a live class session, processed via our video
              provider (LiveKit) to enable the call — sessions are not recorded unless the School enables
              recording and says so separately.</li>
            <li>Technical data: IP address and basic request logs, kept for security and abuse prevention.</li>
          </ul>
        </Section>

        <Section title="3. How we use this information">
          <p>
            Solely to provide the service the School has signed up for: running attendance, grading,
            fee tracking, communication, and live classes; securing accounts (e.g. detecting repeated
            failed logins); and sending the notifications a School configures (e.g. a parent notified
            their child was marked absent).
          </p>
          <p>We do not sell personal data, and we do not use student data for advertising.</p>
        </Section>

        <Section title="4. Children's data">
          <p>
            iSchool is used by schools to manage records belonging to minors. Accounts for students and
            parents/guardians are created and managed by the School, which is responsible for obtaining
            any consent required under applicable law before creating those accounts. Parents/guardians
            may ask their School to access, correct, or delete their child&apos;s data at any time.
          </p>
        </Section>

        <Section title="5. Where data is stored, and who else sees it">
          <p>
            Data is stored in a shared database, logically separated per school — no school can see
            another school&apos;s data. We use the following processors to run the service:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Database and application hosting (see [Hosting Provider / Region]).</li>
            <li>LiveKit for live-class video/audio transport.</li>
            <li>[Email provider] for password-reset and notification emails, once configured.</li>
            <li>[SMS provider] for SMS notifications, if the School enables this.</li>
          </ul>
        </Section>

        <Section title="6. Data retention">
          <p>
            We retain data for as long as the School&apos;s account is active, plus a reasonable period
            after cancellation to allow the School to export its records, after which it is deleted.
            Backups are retained for up to [14] days on a rolling basis.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>
            Depending on where you are, you may have rights to access, correct, export, or delete your
            personal data, and to object to certain processing. Because each School controls its own
            data, please contact your School&apos;s administrator first — they can action most requests
            directly, or escalate to us at [privacy@yourcompany.example].
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            Passwords are hashed, never stored in plain text. Access to a school&apos;s data is
            restricted to that school&apos;s own staff, plus platform administrators for support
            purposes. We run regular backups. No system is perfectly secure, and we encourage strong,
            unique passwords for every account.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We&apos;ll update this page if how we handle data changes, and update the &quot;last
            updated&quot; date above.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            [Your Company Legal Name], [Registered Address]. For privacy questions: [privacy@yourcompany.example].
          </p>
        </Section>
      </main>
    </div>
  );
}
