import { GrainOverlay, UtilityBar, MarketingHeader, MarketingFooter, CREAM } from "@/components/marketing/chrome";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: CREAM }}>
      <GrainOverlay />
      <UtilityBar />
      <MarketingHeader />
      <main className="relative flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
