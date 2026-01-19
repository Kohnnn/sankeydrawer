import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DiagramProvider } from "@/context/DiagramContext";
import { StudioProvider } from "@/context/StudioContext";
import { AISettingsProvider } from "@/context/AISettingsContext";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
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
