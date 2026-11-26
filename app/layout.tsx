import type { Metadata } from "next";
import { Anek_Devanagari, Anek_Latin, Anek_Telugu, JetBrains_Mono } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

// Anek is one type family drawn for English, Telugu and Hindi, so all three tutor languages match.
const sans = Anek_Latin({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const telugu = Anek_Telugu({ subsets: ["telugu"], variable: "--font-telugu", display: "swap", preload: false });
const deva = Anek_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "StuckPoint",
  description: "A kinematics tutor that finds the exact idea you got wrong, fixes it, and checks that you learned it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${telugu.variable} ${deva.variable} ${mono.variable}`}>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
