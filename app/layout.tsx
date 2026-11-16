import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { ApiWakeupNotice } from "@/components/layout/ApiWakeupNotice";
import { MessageToastNotifier } from "@/components/messages/MessageToastNotifier";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

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
    <html lang="en">
      <body>
        <AuthProvider>
          <AppHeader />
          <ApiWakeupNotice />
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
