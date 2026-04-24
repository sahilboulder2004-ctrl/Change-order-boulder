import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Change Order Tracker",
  description: "G701-style change order management for construction projects",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
