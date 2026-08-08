import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Avilingo",
  description: "English conversation lessons with an AI avatar",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
