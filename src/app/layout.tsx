import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://property.com.ve"),
  title: {
    default: "Property.com.ve | Find Your Dream Property in Venezuela",
    template: "%s | Property.com.ve",
  },
  description:
    "Search thousands of properties for sale across Venezuela. Find apartments, houses, commercial spaces, and land from multiple sources in one place.",
  keywords: [
    "Venezuela real estate",
    "property Venezuela",
    "buy house Venezuela",
    "Caracas apartments",
    "Venezuela property for sale",
    "Margarita Island real estate",
  ],
  authors: [{ name: "Property.com.ve" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL,
    siteName: "Property.com.ve",
    title: "Property.com.ve | Find Your Dream Property in Venezuela",
    description:
      "Search thousands of properties for sale across Venezuela. Find apartments, houses, commercial spaces, and land.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Property.com.ve - Find Your Dream Property",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Property.com.ve | Find Your Dream Property in Venezuela",
    description:
      "Search thousands of properties for sale across Venezuela.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} antialiased min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
