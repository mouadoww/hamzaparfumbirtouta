import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sidou Emballage | Élégance & Fêtes",
  description: "Vente d'emballages premium et gâteaux pour vos fêtes et célébrations. Basé à Birkhadem.",
  openGraph: {
    title: "Sidou Emballage | Élégance & Fêtes",
    description: "Une touche de royauté pour chaque occasion spéciale. Découvrez notre sélection d'emballages et gâteaux de fête.",
    siteName: "Sidou Emballage",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 600,
        alt: "Logo Sidou Emballage",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  );
}