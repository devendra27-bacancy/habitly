import type { Metadata, Viewport } from "next";
import { Nunito, Fredoka } from "next/font/google";
import { AuthProvider } from "../components/AuthProvider";
import "./globals.css";

const nunito = Nunito({ 
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
});

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Habitly",
  description: "Go for better habits with Moe!",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    title: "Habitly",
  },
};

export const viewport: Viewport = {
  themeColor: "#b8ddb0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${nunito.variable} ${fredoka.variable}`}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <div id="toast-container"></div>
      </body>
    </html>
  );
}
