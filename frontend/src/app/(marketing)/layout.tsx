import { MarketingHeader, MarketingFooter, BG } from "@/components/marketing/chrome";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: BG }}>
      <MarketingHeader />
      <main className="relative flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
