// src/components/dashboard/ProfileModal.jsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function ProfileModal({ isOpen, onClose }) {
  const { data: session } = useSession();
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, onClose]);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
    onClose();
  };

  const menuItems = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      label: 'Profile Settings',
      action: () => console.log('Profile settings')
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h5c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2z" />
        </svg>
      ),
      label: 'Watchlist',
      action: () => console.log('Watchlist')
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
      ),
      label: 'Alerts & Notifications',
      action: () => console.log('Notifications')
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      ),
      label: 'Preferences',
      action: () => console.log('Preferences')
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Help & Support',
      action: () => console.log('Help')
    }
  ];

  if (!isOpen || !session) return null;

  return (
    <>
      {/* Backdrop - only visible on mobile */}
      <div 
        className={`fixed inset-0 z-40 transition-opacity duration-200 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      {/* Modal positioned relative to the parent container */}
      <div 
        ref={modalRef}
        className={`absolute right-0 top-full mt-2 z-50 w-80 max-w-sm transform transition-all duration-200 ease-out origin-top-right ${
          isOpen 
            ? 'scale-100 opacity-100 translate-y-0' 
            : 'scale-95 opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* Arrow pointing up */}
        <div className="absolute -top-2 right-4 w-4 h-4 bg-zinc-900 border-l border-t border-zinc-700 transform rotate-45"></div>
        
        <div className="bg-zinc-900 rounded-xl shadow-2xl border border-zinc-700 overflow-hidden">
          {/* Profile Header */}
          <div className="p-6 bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-zinc-700">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center ring-2 ring-zinc-600">
                  {session.user.image ? (
                    <img 
                      src={session.user.image} 
                      alt="Profile" 
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <span className="text-lg font-bold text-gray-900">
                      {session.user.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-zinc-900"></div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{session.user.name}</h3>
                <p className="text-sm text-gray-400 truncate">{session.user.email}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-600/20 text-blue-300 rounded-full">
                    Pro Plan
                  </span>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs text-gray-500">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.action}
                className="w-full text-left px-6 py-3 text-gray-300 hover:text-white hover:bg-zinc-800 transition-all duration-150 flex items-center space-x-3 group"
              >
                <span className="text-gray-400 group-hover:text-blue-400 transition-colors">
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
                <span className="ml-auto text-gray-600 group-hover:text-gray-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-700 my-2"></div>

          {/* Account Info */}
          <div className="px-6 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Account Status</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium">Online</span>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <div className="border-t border-zinc-700 p-2">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all duration-150 flex items-center space-x-3 rounded-lg group font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
              <span className="ml-auto text-red-600 group-hover:text-red-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}