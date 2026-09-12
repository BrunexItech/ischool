import { PageLoader } from "@/components/Spinner";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <PageLoader />
    </div>
  );
}
