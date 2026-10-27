import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const figtree = Figtree({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Milai School", template: "%s · Milai School" },
  description: "Milai School 360: the school's own management platform",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Milai School" },
};

export const viewport: Viewport = {
  themeColor: "#A71C20",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      style={{ backgroundColor: "#ffffff" }}
      className={`${figtree.variable} ${jetbrainsMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <TooltipProvider delay={200}>
            {children}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
