import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display-loaded", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body-loaded", display: "swap" });

export const metadata: Metadata = {
  title: "Patient Stories",
  description: "Private video stories and treatment journal for patients of Advanced TMS Clinic and Pacific Health Systems.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F1E3D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body
        style={
          {
            "--font-display": "var(--font-display-loaded), Georgia, serif",
            "--font-body": "var(--font-body-loaded), system-ui, sans-serif",
          } as React.CSSProperties
        }
      >
        <div className="dev-banner" role="note">
          Prototype · sample data only · do not enter real patient information
        </div>
        {children}
      </body>
    </html>
  );
}
