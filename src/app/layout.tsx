import type { Metadata } from "next";
import { Oswald, Source_Serif_4 } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./doctrine.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Army Field Manual Library",
  description:
    "Browse and search all 51 active U.S. Army Field Manuals. Ask doctrinal questions with AI-cited answers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#4a5524", // matches --olive
          fontFamily: "var(--font-source-serif), Georgia, serif",
        },
      }}
    >
      <html lang="en" className={`${oswald.variable} ${sourceSerif.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
