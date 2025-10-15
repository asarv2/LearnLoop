"use client";
import { Clock, CreditCard, Mail } from "lucide-react";
import { useState } from "react";
import AuthModal from "./auth/AuthModal";

const ComingSoonPage = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const handleGetStarted = () => {
    setAuthMode("signup");
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">L</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  LearnLoop
                </span>
              </div>

              <div className="flex items-center space-x-6">
                <button
                  onClick={() => window.open("/", "_self")}
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Home
                </button>
                <button
                  onClick={() => window.open("/about", "_self")}
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  About Us
                </button>
                <button
                  onClick={() => window.open("/pricing", "_self")}
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Pricing
                </button>
                <button
                  onClick={() =>
                    window.open(
                      "https://calendly.com/siladiea2005/learnloop-demo",
                      "_blank"
                    )
                  }
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Book Demo
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleGetStarted}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors px-4 py-2"
              >
                Sign Up
              </button>
              <button
                onClick={() => window.open("/get-started", "_self")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl mb-8">
              <CreditCard className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Payment Integration Coming Soon
            </h1>

            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-12">
              We&apos;re working hard to bring you a seamless payment experience
              with Stripe. In the meantime, you can still get started with
              LearnLoop.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 max-w-2xl mx-auto mb-12">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Clock className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  What&apos;s Available Now
                </h2>
              </div>

              <div className="space-y-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">
                    Free trial access to all features
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">
                    Full platform experience
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">
                    Book a demo to see LearnLoop in action
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleGetStarted}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold transition-colors"
              >
                Start Free Trial
              </button>
              <button
                onClick={() =>
                  window.open(
                    "https://calendly.com/siladiea2005/learnloop-demo",
                    "_blank"
                  )
                }
                className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
              >
                Book Demo
              </button>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Mail className="w-5 h-5" />
                <span>Questions? Contact us at support@learnloop.com</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <span className="text-xl font-bold">LearnLoop</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2025 LearnLoop. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </div>
  );
};

export default ComingSoonPage;
