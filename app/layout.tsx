import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThreadOps Commerce OS",
  description: "Order, inventory, accounting, courier, and ads operations for ecommerce clothing brands.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
