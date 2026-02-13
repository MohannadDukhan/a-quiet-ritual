import "./globals.css";

import { AuthProvider } from "@/components/auth-provider";
import { TimeZoneCookieSync } from "@/components/timezone-cookie-sync";

export const metadata = {
  title: "a quiet ritual",
  description: "a quiet daily ritual",
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
