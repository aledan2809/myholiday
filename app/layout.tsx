import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Holiday",
  description: "MVP care coreleaza zboruri, hoteluri si transferuri pentru oferte last-minute in Europa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="antialiased" style={{ fontFamily: "'Geist', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
