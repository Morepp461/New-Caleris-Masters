import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CALERIS MASTERS",
  description: "A motorsport roleplay game universe.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
