import type { Metadata } from "next";
import { Rubik, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { routing, dirOf } from "@/lib/i18n/routing";
import "../globals.css";

const rubik = Rubik({
  subsets: ["latin", "arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rubik",
  display: "swap",
});

/**
 * Loaded globally (self-hosted, no extra npm dependency — next/font handles
 * that) but only actually used where a component opts into `font-inter`.
 * Pilot scope: Daily Operations only. Everything else keeps rendering Rubik.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pyramids Ops",
  description: "Internal operations tracker",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Dark is the default for every existing session — light is opt-in only,
  // via the sidebar's theme toggle, which sets this cookie. No cookie means
  // no attribute, which means the dark values in globals.css's bare @theme
  // block apply, exactly as before this pass.
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : undefined;

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-theme={theme}
      className={`${rubik.variable} ${inter.variable}`}
    >
      <body className="bg-canvas text-ink">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
