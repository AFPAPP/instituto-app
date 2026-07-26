import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alliance Française Portoviejo — Sistema de Gestión",
  description: "Sistema de gestión académica de la Alliance Française Portoviejo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
