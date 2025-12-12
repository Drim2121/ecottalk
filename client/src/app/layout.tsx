import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EcoTalk",
  description: "Best chat app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}