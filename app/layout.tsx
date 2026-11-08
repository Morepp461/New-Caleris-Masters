import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Caleris Masters | Motorsport Management", description: "Caleris Masters, motorsport roleplay management platform." };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="id"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></head><body>{children}</body></html>;
}
