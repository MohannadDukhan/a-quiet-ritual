import "./globals.css";
import type { Metadata } from "next";

import { AuthProvider } from "@/components/auth-provider";
import { Footer } from "@/components/layout/footer";
import { TimeZoneCookieSync } from "@/components/timezone-cookie-sync";

export const metadata: Metadata = {
  title: "a quiet ritual",
  description: "a quiet daily ritual",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "a quiet ritual",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bw-body">
        <TimeZoneCookieSync />
        <AuthProvider>
          <div className="bw-appShell">
            <div className="bw-appContent">{children}</div>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
