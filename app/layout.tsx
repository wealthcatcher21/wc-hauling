import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WC Hauling Polk | Junk Removal – Winter Haven, FL",
  description:
    "Fast, affordable junk removal in Winter Haven and Polk County. Same-day and next-day service available. Get a free quote today.",
  keywords: "junk removal Winter Haven FL, junk removal Polk County, haul away, trash removal, furniture removal",
  openGraph: {
    title: "WC Hauling Polk | Junk Removal – Winter Haven, FL",
    description: "Fast, affordable junk removal in Winter Haven and Polk County.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
