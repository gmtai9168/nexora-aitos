import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { SystemFooter } from "@/components/SystemFooter";
import { MarketProvider } from "@/lib/market-context";
import { LiveAccountProvider } from "@/lib/live-account";
import { UiProvider } from "@/lib/ui-context";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const thai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NEXORA AITOS — AI Trading Operating System",
  description:
    "ศูนย์ควบคุมการเทรดด้วย AI — คริปโต หุ้นไทย และหุ้นต่างประเทศ แบบเรียลไทม์",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${thai.variable} ${mono.variable} h-full`}
    >
      <body
        className="min-h-full bg-bg text-txt antialiased"
        style={{ fontFamily: "var(--font-thai), var(--font-inter), sans-serif" }}
      >
        <MarketProvider>
          <LiveAccountProvider>
            <UiProvider>
              <TopBar />
              <Sidebar />
              <div className="flex min-h-[calc(100vh-70px)] min-w-0 flex-col overflow-x-hidden lg:ml-[196px]">
                <main className="min-w-0 flex-1 p-2 sm:p-2.5">{children}</main>
                <SystemFooter />
              </div>
            </UiProvider>
          </LiveAccountProvider>
        </MarketProvider>
      </body>
    </html>
  );
}
