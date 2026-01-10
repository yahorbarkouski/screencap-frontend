import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const matter = localFont({
  src: [
    { path: "../public/Matter/Matter/Matter-TRIAL-Light.woff2", weight: "300", style: "normal" },
    { path: "../public/Matter/Matter/Matter-TRIAL-LightItalic.woff2", weight: "300", style: "italic" },
    { path: "../public/Matter/Matter/Matter-TRIAL-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/Matter/Matter/Matter-TRIAL-RegularItalic.woff2", weight: "400", style: "italic" },
    { path: "../public/Matter/Matter/Matter-TRIAL-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/Matter/Matter/Matter-TRIAL-MediumItalic.woff2", weight: "500", style: "italic" },
    { path: "../public/Matter/Matter/Matter-TRIAL-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../public/Matter/Matter/Matter-TRIAL-SemiBoldItalic.woff2", weight: "600", style: "italic" },
    { path: "../public/Matter/Matter/Matter-TRIAL-Bold.woff2", weight: "700", style: "normal" },
    { path: "../public/Matter/Matter/Matter-TRIAL-BoldItalic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-matter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Screencap — to understand where your day went",
  description:
    "A macOS desktop app that captures screenshots, windows and apps (both background and foreground) on a schedule and transforms them into a timeline, daily summaries, project milestones, addiction tracking, with optional E2E-encrypted social feed. ",
  openGraph: {
    title: "Screencap — To understand where your day went",
    description:
      "A macOS desktop app that captures screenshots, windows and apps (both background and foreground) on a schedule and transforms them into a timeline, daily summaries, project milestones, addiction tracking, with optional E2E-encrypted social feed. ",
    type: "website",
    url: "https://screencaping.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Screencap — To understand where your day went",
    description:
      "A macOS desktop app that captures screenshots, windows and apps (both background and foreground) on a schedule and transforms them into a timeline, daily summaries, project milestones, addiction tracking, with optional E2E-encrypted social feed. ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${matter.variable} ${spaceGrotesk.variable} antialiased bg-background`}>
        {children}
      </body>
    </html>
  );
}
