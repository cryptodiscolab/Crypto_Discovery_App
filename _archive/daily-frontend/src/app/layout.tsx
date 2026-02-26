import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import "@coinbase/onchainkit/styles.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Crypto Disco Daily",
  description: "Complete tasks and earn disco points",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} font-sans antialiased bg-slate-950 text-white min-h-screen`}>
        <Providers>
          <div className="max-w-md mx-auto min-h-screen bg-slate-900 shadow-2xl shadow-indigo-500/10 flex flex-col">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
