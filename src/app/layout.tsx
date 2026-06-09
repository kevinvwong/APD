import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Army Field Manuals",
  description: "All active US Army Field Manuals in searchable markdown",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
