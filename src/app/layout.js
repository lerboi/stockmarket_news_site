// src/app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import { AuthModalProvider } from '@/lib/auth-context';
import SessionProvider from '@/components/auth/SessionProvider';
import LoginModal from '@/components/auth/LoginModal';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "PennystockAI - AI-Powered Market Intelligence",
  description: "Get filtered FDA announcements and breakthrough drug approvals before the market reacts. AI-powered penny stock trading intelligence.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <AuthModalProvider>
            {children}
            <LoginModal />
          </AuthModalProvider>
        </SessionProvider>
      </body>
    </html>
  );
}