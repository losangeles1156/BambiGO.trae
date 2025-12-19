import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import SwRegister from "../../components/SwRegister";
import { AuthProvider } from "../components/auth/AuthContext";
import { LanguageProvider } from "../contexts/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevent zooming on map apps
  themeColor: "#0b3d91",
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "BambiGO",
  description: "AI Agent for Barrier-Free Travel",
  manifest: "/manifest.json",
};

import { SOPProvider } from "../contexts/SOPContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <LanguageProvider>
            <SOPProvider>
              <SwRegister />
              {children}
            </SOPProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
