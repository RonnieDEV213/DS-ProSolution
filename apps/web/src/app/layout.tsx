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
      <head>
        {/* Inline blocking script: fix data-theme for system theme resolution.
            next-themes' inline script applies the value map to `class` but NOT to
            `data-theme` attributes. When the stored theme is "system", the script
            sets data-theme="light"/"dark" instead of data-theme="dawn"/"carbon".
            This observer patches the value before first paint so CSS selectors
            like [data-theme="dawn"] match immediately. Disconnects after first
            correction to avoid interfering with React hydration. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement,m={light:"dawn",dark:"carbon"};new MutationObserver(function(muts,obs){var v=d.getAttribute("data-theme");if(v&&m[v]){d.setAttribute("data-theme",m[v])}obs.disconnect()}).observe(d,{attributes:true,attributeFilter:["data-theme"]})})()`,
          }}
          suppressHydrationWarning
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute={["class", "data-theme"]}
          defaultTheme="system"
          enableSystem={true}
          themes={["system", "midnight", "dawn", "slate", "carbon"]}
          disableTransitionOnChange={true}
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
