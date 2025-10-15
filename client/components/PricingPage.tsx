"use client";
import { ArrowRight, Calendar, Users, Zap } from "lucide-react";
import { useState } from "react";
import AuthModal from "./auth/AuthModal";

const PricingPage = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const handleGetStarted = () => {
    setAuthMode("signup");
    setAuthModalOpen(true);
  };

  const pricingTiers = [
    {
      name: "Starter",
      price: 5000,
      includedUsers: 50,
      additionalUserPrice: 50,
      additionalUserLimit: 20,
    },
    {
      name: "Growth",
      price: 8000,
      includedUsers: 100,
      additionalUserPrice: 40,
      additionalUserLimit: 25,
    },
    {
      name: "Professional",
      price: 15000,
      includedUsers: 250,
      additionalUserPrice: 30,
      additionalUserLimit: 40,
    },
    {
      name: "Scale",
      price: 25000,
      includedUsers: 500,
      additionalUserPrice: 25,
      additionalUserLimit: 60,
    },
    {
      name: "Enterprise",
      price: "Custom",
      includedUsers: "500+",
      additionalUserPrice: "Custom",
      additionalUserLimit: "Unlimited",
      isEnterprise: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <button
                onClick={() => window.open("/", "_self")}
                className="flex items-center space-x-3"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">L</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  LearnLoop
                </span>
              </button>

              <div className="flex items-center space-x-6">
                <button
                  onClick={() => window.open("/about", "_self")}
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  About Us
                </button>
                <button
                  onClick={() => window.open("/pricing", "_self")}
                  className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Pricing
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
                onClick={() =>
                  window.open(
                    "https://calendly.com/siladiea2005/learnloop-demo",
                    "_blank"
                  )
                }
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Book Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Choose Your Plan
            </h1>
          </div>

          {/* Free Trial Banner */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Zap className="w-8 h-8 text-blue-600" />
                <h3 className="text-2xl font-bold text-gray-900">
                  Free 1st Month Trial
                </h3>
              </div>
              <p className="text-lg text-gray-600 mb-6">
                Try any plan risk-free for 30 days. No credit card required.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>Start your free trial today</span>
                <ArrowRight className="w-4 h-4" />
                <span>Choose your plan below</span>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {pricingTiers.map((tier, index) => {
              const isEnterprise = tier.isEnterprise;

              return (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="text-center">
                    {/* Plan Name */}
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      {tier.name}
                    </h3>

                    {/* Price */}
                    <div className="mb-6">
                      {isEnterprise ? (
                        <div className="text-2xl font-bold text-gray-900">
                          Custom
                        </div>
                      ) : (
                        <div className="text-2xl font-bold text-gray-900">
                          ${tier.price.toLocaleString()} Yearly
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-center gap-2">
                        <Users className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {tier.includedUsers} Users
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Additional Users:{" "}
                        {isEnterprise
                          ? "Custom"
                          : `$${tier.additionalUserPrice} Each`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {isEnterprise
                          ? "Contact for Volume Pricing"
                          : `Up to ${tier.additionalUserLimit} Additional Users`}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="mt-6">
                      {isEnterprise ? (
                        <button
                          onClick={() =>
                            window.open(
                              "https://calendly.com/siladiea2005/learnloop-demo",
                              "_blank"
                            )
                          }
                          className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Contact Sales
                        </button>
                      ) : (
                        <button
                          onClick={() => window.open("/get-started", "_self")}
                          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Start Free Trial
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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

export default PricingPage;
