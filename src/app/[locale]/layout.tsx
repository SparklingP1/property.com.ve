import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import "../globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isSpanish = locale === "es";

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://property.com.ve"),
    title: {
      default: isSpanish
        ? "Property.com.ve | Encuentra tu Propiedad Ideal en Venezuela"
        : "Property.com.ve | Find Your Dream Property in Venezuela",
      template: "%s | Property.com.ve",
    },
    description: isSpanish
      ? "Miles de inmuebles en venta en toda Venezuela. Apartamentos, casas, locales comerciales y terrenos de múltiples fuentes en un solo lugar."
      : "Search thousands of properties for sale across Venezuela. Find apartments, houses, commercial spaces, and land from multiple sources in one place.",
    keywords: isSpanish
      ? ["inmuebles Venezuela", "propiedad Venezuela", "comprar casa Venezuela", "apartamentos Caracas", "inmuebles en venta Venezuela", "bienes raíces Isla Margarita"]
      : ["Venezuela real estate", "property Venezuela", "buy house Venezuela", "Caracas apartments", "Venezuela property for sale", "Margarita Island real estate"],
    authors: [{ name: "Property.com.ve" }],
    openGraph: {
      type: "website",
      locale: isSpanish ? "es_VE" : "en_US",
      url: process.env.NEXT_PUBLIC_SITE_URL,
      siteName: "Property.com.ve",
      title: isSpanish
        ? "Property.com.ve | Encuentra tu Propiedad Ideal en Venezuela"
        : "Property.com.ve | Find Your Dream Property in Venezuela",
      description: isSpanish
        ? "Miles de inmuebles en venta en toda Venezuela. Apartamentos, casas, locales comerciales y terrenos."
        : "Search thousands of properties for sale across Venezuela. Find apartments, houses, commercial spaces, and land.",
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
      title: isSpanish
        ? "Property.com.ve | Encuentra tu Propiedad Ideal en Venezuela"
        : "Property.com.ve | Find Your Dream Property in Venezuela",
      description: isSpanish
        ? "Miles de inmuebles en venta en toda Venezuela. Apartamentos, casas, locales comerciales y terrenos."
        : "Search thousands of properties for sale across Venezuela.",
    },
    robots: {
      index: true,
      follow: true,
    },
    other: {
      "theme-color": "#fafafa",
    },
  };
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${dmSans.variable} antialiased min-h-screen flex flex-col`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:shadow-lg">
          Skip to content
        </a>
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
