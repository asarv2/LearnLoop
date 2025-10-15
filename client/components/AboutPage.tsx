"use client";
import { useState } from "react";
import AuthModal from "./auth/AuthModal";

const AboutPage = () => {
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
                  className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
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
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              About LearnLoop
            </h1>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="prose prose-lg prose-gray max-w-none">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                LearnLoop was founded by two Purdue University AI researchers
                passionate about improving how people learn, grow, and
                communicate in the workplace. Our journey began at Purdue, where
                we developed an AI-based training platform to help teaching
                assistants improve their communication with students. The
                success and impact of that project inspired us to build
                LearnLoop — a company dedicated to helping organizations empower
                their employees to have better, more effective conversations.
              </p>

              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                At LearnLoop, we believe that communication is the foundation of
                every successful team. Using advanced AI technology, we create
                interactive, real-time training experiences that allow employees
                to practice high-stakes conversations — from leadership
                discussions to customer interactions — in a safe,
                feedback-driven environment.
              </p>

              <p className="text-lg text-gray-700 leading-relaxed">
                Our mission is simple: to make professional growth more
                engaging, personalized, and measurable through the power of AI.
              </p>
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

export default AboutPage;
