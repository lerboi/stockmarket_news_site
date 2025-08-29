// src/components/landing/Navbar.js
'use client';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAuthModal } from '@/lib/auth-context';
import Link from 'next/link';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: session } = useSession();
  const { openLoginModal } = useAuthModal();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <nav className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-40 backdrop-blur-md bg-zinc-950/90">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-white">
              Pennystock<span className="text-gray-400">AI</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-400 hover:text-white transition-colors font-medium">
              Features
            </Link>
            <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors font-medium">
              Pricing
            </Link>
            <Link href="#about" className="text-gray-400 hover:text-white transition-colors font-medium">
              About
            </Link>
            <Link href="#contact" className="text-gray-400 hover:text-white transition-colors font-medium">
              Contact
            </Link>
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-4">
                <Link 
                  href="/dashboard"
                  className="hidden sm:block text-gray-400 hover:text-white transition-colors font-medium"
                >
                  Dashboard
                </Link>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    {session.user.image ? (
                      <img 
                        src={session.user.image} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">
                        {session.user.name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm text-gray-300 font-medium">{session.user.name}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-400 hover:text-gray-300 transition-colors text-sm font-medium"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={openLoginModal}
                className="bg-white hover:bg-gray-100 text-gray-900 font-medium px-6 py-2 rounded-lg transition-colors"
              >
                Sign In
              </button>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-zinc-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-zinc-800">
            <nav className="flex flex-col space-y-3">
              <Link href="#features" className="text-gray-400 hover:text-white transition-colors py-2 font-medium">
                Features
              </Link>
              <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors py-2 font-medium">
                Pricing
              </Link>
              <Link href="#about" className="text-gray-400 hover:text-white transition-colors py-2 font-medium">
                About
              </Link>
              <Link href="#contact" className="text-gray-400 hover:text-white transition-colors py-2 font-medium">
                Contact
              </Link>
              {session && (
                <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors py-2 font-medium">
                  Dashboard
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </nav>
  );
}