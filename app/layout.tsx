import "./globals.css";

export const metadata = {
  title: "DISC Colors Test",
  description: "Telegram Mini App test",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
