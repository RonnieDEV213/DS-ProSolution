import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";
import { DatabaseProvider } from "@/components/providers/database-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemedToaster } from "@/components/providers/themed-toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DS-ProSolution",
  description: "Order tracking and bookkeeping management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute={["class", "data-theme"]}
          defaultTheme="system"
          enableSystem={true}
          themes={["system", "midnight", "dawn", "slate", "carbon"]}
          disableTransitionOnChange={false}
          value={{
            midnight: "midnight",
            dawn: "dawn",
            slate: "slate",
            carbon: "carbon",
            dark: "carbon",
            light: "dawn",
          }}
        >
          <TooltipProvider>
            <DatabaseProvider>
              <QueryProvider>
                {children}
              </QueryProvider>
            </DatabaseProvider>
            <ThemedToaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
