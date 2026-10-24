import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Little Booth — A photobooth for two",
  description: "A shared online photobooth for two people, wherever they are.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
