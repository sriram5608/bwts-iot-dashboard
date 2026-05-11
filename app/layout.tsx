import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { getLocale } from '@/lib/locale'
import { DemoProvider } from '@/lib/demo-context'
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-jp",
  preload: false,
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-kr",
  preload: false,
});

export const metadata: Metadata = {
  title: "BWTS Monitoring Dashboard - Metaweave Star",
  description: "Real-time monitoring and predictive maintenance dashboard for Ballast Water Treatment System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  const fontClass = locale === 'ja'
    ? `${dmSans.className} ${notoSansJP.variable}`
    : locale === 'ko'
    ? `${dmSans.className} ${notoSansKR.variable}`
    : dmSans.className

  return (
    <html lang={locale}>
      <body className={`${fontClass} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DemoProvider>
            {children}
          </DemoProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
