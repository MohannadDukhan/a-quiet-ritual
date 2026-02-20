import "./globals.css";

import { AuthProvider } from "@/components/auth-provider";
import { Footer } from "@/components/layout/footer";
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
