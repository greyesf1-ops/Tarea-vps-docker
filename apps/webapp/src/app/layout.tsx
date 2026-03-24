import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

import { Providers } from "@/components/providers";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading"
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Support Intake AI",
  description:
    "Clasificador y extractor de documentos de soporte con IA, tools y salida estructurada."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-shell text-slate-950 antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
