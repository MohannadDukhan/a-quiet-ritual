import "./globals.css";
import { Arimo } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";

const arimo = Arimo({
  subsets: ["latin"],
  weight: ["400", "700"],
});

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
      <body className={arimo.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
