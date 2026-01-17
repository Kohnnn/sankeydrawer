import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { DiagramProvider } from "@/context/DiagramContext";
import { StudioProvider } from "@/context/StudioContext";
import { AISettingsProvider } from "@/context/AISettingsContext";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Financial Sankey Studio",
  description: "Professional financial visualization platform for creating Sankey diagrams",
  keywords: ["sankey", "diagram", "financial", "visualization", "chart"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.className} antialiased`} suppressHydrationWarning>
        <AISettingsProvider>
          <DiagramProvider>
            <StudioProvider>
              {children}
            </StudioProvider>
          </DiagramProvider>
        </AISettingsProvider>
      </body>
    </html>
  );
}
