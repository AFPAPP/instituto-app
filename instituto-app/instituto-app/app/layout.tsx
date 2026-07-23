import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AFP Portoviejo — Sistema de Gestión",
  description: "Sistema de gestión académica del instituto de francés",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
