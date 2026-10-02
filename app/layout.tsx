import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { MessageToastNotifier } from "@/components/messages/MessageToastNotifier";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EcoLoop — Industrial waste marketplace",
  description:
    "AI-powered industrial waste redistribution marketplace for SME manufacturers in Lagos.",
  icons: {
    icon: "/assets/ecoloop-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <AuthProvider>
          <AppHeader />
          <AppNav />
          <AuthGate>
            <main>{children}</main>
          </AuthGate>
          <MessageToastNotifier />
        </AuthProvider>
      </body>
    </html>
  );
}
