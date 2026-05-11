import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://talkroy.com"),
  title: {
    default: "TalkRoy Messenger",
    template: "%s · TalkRoy",
  },
  description:
    "TalkRoy Messenger — Talk freely. Stay connected. Современный веб-мессенджер.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/images/talkroy-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.svg" }],
    apple: [
      { url: "/images/talkroy-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
  /** Без `capable: true` — не вставляем устаревший meta apple-mobile-web-app-capable */
  appleWebApp: {
    capable: false,
    title: "TalkRoy",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#7c3aed",
    "msapplication-config": "/favicons/browserconfig.xml",
  },
  openGraph: {
    title: "TalkRoy Messenger",
    description: "Talk freely. Stay connected.",
    siteName: "TalkRoy",
    type: "website",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "TalkRoy Messenger",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TalkRoy Messenger",
    description: "Talk freely. Stay connected.",
    images: ["/images/twitter-card.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
