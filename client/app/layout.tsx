import type { Metadata } from "next";
import { Bricolage_Grotesque, Sora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/utils/WalletProvider";

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage-grotesque",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rotor",
  description: "Privacy focused protocol on Stellar",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased ${bricolageGrotesque.variable} ${sora.variable} ${ibmPlexMono.variable}`}
      >
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
