// src/components/dashboard/DashboardHeader.js
'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import ProfileModal from './ProfileModal';

export default function DashboardHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { data: session } = useSession();

  const toggleProfileModal = () => {
    setIsProfileModalOpen(!isProfileModalOpen);
  };

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 relative">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <div className="text-xl font-bold text-white">
              Pennystock<span className="text-gray-400">AI</span>
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
            {session && (
              <div className="hidden sm:flex items-center space-x-3">
                <button
                  onClick={toggleProfileModal}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                >
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
                  <span className="text-sm text-gray-300">{session.user.name}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
            
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
              {session && (
                <button
                  onClick={toggleProfileModal}
                  className="flex items-center space-x-3 text-gray-300 hover:text-white transition-colors py-2"
                >
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    {session.user.image ? (
                      <img 
                        src={session.user.image} 
                        alt="Profile" 
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-900">
                        {session.user.name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <span>Profile</span>
                </button>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </header>
  );
}