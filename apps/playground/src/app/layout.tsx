import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playground · Beside",
  description:
    "A browser workbench for exploring subjects, activities, logs, ownership, and event delivery.",
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
