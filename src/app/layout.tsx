import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const body = Geist({ subsets: ["latin"], variable: "--font-body" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Fixsure · Pay for the fix, not the promise", template: "%s · Fixsure" },
  description: "Home-repair escrow on PayPal. AI prices the job from a photo, and the hold is only captured when the after photo proves the fix.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <TopBar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
