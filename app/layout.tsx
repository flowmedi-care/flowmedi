import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/ui/toast";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const FAVICON_ICO_URL = "/favicon.ico?v=20260311";
const BRAND_ICON_SVG_URL = "/brand/flowmedi-icon.svg?v=20260311";

export const metadata: Metadata = {
  title: "FlowMedi — Agenda e formulários para sua clínica",
  description:
    "Centralize agenda, formulários clínicos e comunicação com o paciente. Autenticação, papéis e LGPD.",
  manifest: "/brand/site.webmanifest",
  icons: {
    icon: [
      { url: FAVICON_ICO_URL, type: "image/x-icon" },
      { url: BRAND_ICON_SVG_URL, type: "image/svg+xml" },
    ],
    shortcut: [{ url: FAVICON_ICO_URL, type: "image/x-icon" }],
    apple: [{ url: BRAND_ICON_SVG_URL, type: "image/svg+xml" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${plusJakarta.variable} font-sans antialiased`}>
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
