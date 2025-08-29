// src/app/page.js
'use client';
import { useAuthModal } from '@/lib/auth-context';
import Navbar from '@/components/landing/Navbar';

export default function LandingPage() {
  const { openLoginModal } = useAuthModal();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white">
            Pennystock<span className="text-gray-400">AI</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto leading-relaxed">
            AI-powered market intelligence for penny stock traders. Get filtered FDA announcements, 
            safety alerts, and breakthrough drug approvals before the market reacts.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={openLoginModal}
              className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
            >
              Start Free Trial
            </button>
            <button className="border border-zinc-700 hover:border-zinc-600 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg hover:bg-zinc-900">
              View Live Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section id="features" className="py-20 px-4 bg-zinc-900/50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-12 text-white">
            Why Traders Choose Us
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-sm hover:shadow-lg hover:border-zinc-700 transition-all">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-4 text-white">AI-Powered Analysis</h3>
              <p className="text-gray-400 leading-relaxed">
                Claude AI analyzes every FDA announcement for market impact, 
                relevance scores, and trading opportunities.
              </p>
            </div>
            
            <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-sm hover:shadow-lg hover:border-zinc-700 transition-all">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-4 text-white">Real-Time Alerts</h3>
              <p className="text-gray-400 leading-relaxed">
                Get notified instantly when high-impact FDA news breaks, 
                before it hits mainstream financial media.
              </p>
            </div>
            
            <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-sm hover:shadow-lg hover:border-zinc-700 transition-all">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-4 text-white">Penny Stock Focus</h3>
              <p className="text-gray-400 leading-relaxed">
                Specialized for small-cap biotech and pharmaceutical companies 
                where FDA news creates the biggest price movements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-white mb-2">10,000+</div>
              <p className="text-gray-400 font-medium">FDA Announcements Analyzed</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">95%</div>
              <p className="text-gray-400 font-medium">Accuracy in Impact Predictions</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">24/7</div>
              <p className="text-gray-400 font-medium">Real-Time Market Monitoring</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-zinc-900/50">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
            Ready to Start Trading Smarter?
          </h2>
          <p className="text-xl text-gray-400 mb-8 leading-relaxed">
            Join thousands of traders who never miss a market-moving FDA announcement.
          </p>
          
          <button
            onClick={openLoginModal}
            className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-12 py-4 rounded-lg transition-all text-lg transform hover:scale-105"
          >
            Get Started Free
          </button>
          
          <p className="text-sm text-gray-500 mt-4">
            No credit card required • 7-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-12 px-4 bg-zinc-950">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-xl font-bold text-white mb-4">
                Pennystock<span className="text-gray-400">AI</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                AI-powered market intelligence for smart penny stock trading.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Disclaimer</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-zinc-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            <p>&copy; 2025 PennystockAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}