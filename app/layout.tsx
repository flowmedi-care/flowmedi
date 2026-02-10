import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "FlowMedi — Agenda e formulários para sua clínica",
  description:
    "Centralize agenda, formulários clínicos e comunicação com o paciente. Autenticação, papéis e LGPD.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
