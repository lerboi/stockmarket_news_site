// src/components/dashboard/DashboardHeader.js
'use client';
import { useState } from 'react';

export default function DashboardHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-zinc-900 border-b border-zinc-800">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <div className="text-xl font-bold text-blue-400">
              PennystockAI
            </div>
            <div className="hidden sm:block text-sm text-gray-400">
              Filtered Market Intelligence
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#" className="text-gray-300 hover:text-white transition-colors">
              Dashboard
            </a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors">
              Watchlist
            </a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors">
              Analytics
            </a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors">
              Settings
            </a>
          </nav>

          {/* User Profile and Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">U</span>
              </div>
              <span className="text-sm text-gray-300">User</span>
            </div>
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-300 hover:text-white hover:bg-zinc-800"
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
              <a href="#" className="text-gray-300 hover:text-white transition-colors py-2">
                Dashboard
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors py-2">
                Watchlist
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors py-2">
                Analytics
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors py-2">
                Settings
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}