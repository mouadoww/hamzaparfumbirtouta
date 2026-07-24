import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hamza Parfum Birtouta | L'Essence de l'Élégance",
  description: "Découvrez notre collection de parfums de luxe. Décants individuels authentiques disponibles à partir de 10ml. Trouvez votre signature olfactive.",
  keywords: ["parfum", "décant", "parfumerie", "Birtouta", "Hamza Parfum", "fragrance", "luxe", "Algérie"],
  authors: [{ name: "Hamza Parfum Birtouta" }],
  
  // Configuration pour un bel affichage sur Facebook, Instagram, WhatsApp, etc.
  openGraph: {
    title: "Hamza Parfum Birtouta | L'Essence de l'Élégance",
    description: "Décants individuels de parfums authentiques à partir de 10ml. Commandez votre fragrance préférée dès maintenant.",
    url: "https://hamzaparfumbirtouta.vercel.app", // Ton futur lien Vercel
    siteName: "Hamza Parfum Birtouta",
    images: [
      {
        url: "/logo.png", // Le logo apparaîtra lors du partage du lien
        width: 800,
        height: 800,
        alt: "Logo Hamza Parfum Birtouta",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  
  // Configuration pour Twitter / X
  twitter: {
    card: "summary_large_image",
    title: "Hamza Parfum Birtouta",
    description: "Décants de parfums authentiques à partir de 10ml.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}