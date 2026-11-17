import "./globals.css";
import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = { title: "Inbox · Telegram reader", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><I18nProvider><ToastProvider>{children}</ToastProvider></I18nProvider></body></html>);
}
