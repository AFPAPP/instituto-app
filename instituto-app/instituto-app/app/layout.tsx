import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alliance Française Portoviejo — Sistema de Gestión",
  description: "Sistema de gestión académica de la Alliance Française Portoviejo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" style={{ colorScheme: 'light' }}>
      <head>
        <meta name="color-scheme" content="light only" />
        <link rel="icon" href="/logo-afp.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{ backgroundColor: '#FAF3E8', colorScheme: 'light' }}>{children}</body>
    </html>
  );
}
