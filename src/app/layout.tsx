import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { SystemFooter } from "@/components/SystemFooter";
import { MarketProvider } from "@/lib/market-context";

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
          <TopBar />
          <Sidebar />
          <div className="ml-[196px] flex min-h-[calc(100vh-70px)] flex-col">
            <main className="flex-1 p-2.5">{children}</main>
            <SystemFooter />
          </div>
        </MarketProvider>
      </body>
    </html>
  );
}
