import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CALERIS MASTERS — Motorsport Roleplay Universe",
  description: "A living motorsport world. Build your career, lead a team, and fight for the championship.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
