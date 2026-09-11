import Link from "next/link";
import { GraduationCap, ClipboardCheck, Wallet, Video, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { icon: ClipboardCheck, title: "Attendance & Results", description: "Track attendance and grades in real time, by class or by term." },
  { icon: Wallet, title: "Fees & Payments", description: "Invoices, balances, and payment tracking your finance office will love." },
  { icon: Video, title: "Live Classes", description: "Built-in video lessons — schedule, host, and share a join link in seconds." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4.5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">iSchool</span>
        </div>
        <Button variant="ghost" render={<Link href="/login">Sign in</Link>} />
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pb-24 pt-12 text-center lg:pt-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            The all-in-one platform for schools and colleges
          </h1>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            Attendance, results, fees, communication, and live online classes — fully
            white-labeled for every school on board.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              size="lg"
              render={
                <Link href="/login">
                  Sign in <ArrowRight />
                </Link>
              }
            />
          </div>
        </div>

        <div className="mt-20 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="text-left">
              <CardContent className="pt-6">
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="size-4.5" />
                </div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
