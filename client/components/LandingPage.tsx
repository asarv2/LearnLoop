"use client";
import { useStatsigAnalytics } from "@/hooks/useStatsigAnalytics";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  Shield,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import AuthModal from "./auth/AuthModal";

const LandingPage = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const {
    logEvent,
    logPageView,
    logNavigationClick,
    logCTAClick,
    logFormSubmission,
    STATSIG_EVENTS,
  } = useStatsigAnalytics();

  // Email subscription state
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");

  // Track page view on component mount
  useEffect(() => {
    logPageView("landing");
  }, [logPageView]);

  // Event handlers for tracking
  const handleNavClick = (destination: string) => {
    logNavigationClick(destination, "landing");
    window.open(`/${destination}`, "_self");
  };

  const handleSignUpClick = () => {
    logCTAClick("sign_up", "landing");
    setAuthMode("signup");
    setAuthModalOpen(true);
  };

  const handleFooterLinkClick = (section: string, destination: string) => {
    logEvent(STATSIG_EVENTS.FOOTER_LINK_CLICKED, {
      section,
      destination,
    });
  };

  const handleEmailSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubscriptionStatus("idle");

    // Log subscription attempt
    logEvent(STATSIG_EVENTS.EMAIL_SUBSCRIPTION_ATTEMPTED, { email });

    try {
      const response = await fetch("/api/v1/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubscriptionStatus("success");
        setSubscriptionMessage(data.message);
        setEmail("");
        logFormSubmission("email_subscription", true, { email });
      } else {
        setSubscriptionStatus("error");
        setSubscriptionMessage(
          data.error || "Something went wrong. Please try again."
        );
        logFormSubmission("email_subscription", false, {
          email,
          error: data.error,
        });
      }
    } catch {
      setSubscriptionStatus("error");
      setSubscriptionMessage(
        "Network error. Please check your connection and try again."
      );
      logFormSubmission("email_subscription", false, {
        email,
        error: "Network error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Carousel state
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const carouselSteps = [
    {
      number: 1,
      title: "Choose a Training Type",
      description:
        "Select from our library of professional training scenarios, take a required training, or create your own custom training.",
      image: "/LP_Images/Step 1.png",
    },
    {
      number: 2,
      title: "Set Up the Training",
      description:
        "Customize your training experience by selecting the voice, job position and mood you want the AI to emobody to simulate a real-life conversation you would have in the workplace.",
      image: "/LP_Images/Step 2.png",
    },
    {
      number: 3,
      title: "Take the Training",
      description:
        "Engage in a realistic voice conversation with AI that responds naturally to your communication style and adapts to your approach.",
      image: "/LP_Images/Step 3.png",
    },
    {
      number: 4,
      title: "Receive Score & Feedback",
      description:
        "Get detailed performance metrics, personalized feedback, and actionable insights to improve your communication skills.",
      image: "/LP_Images/Step 4.png",
    },
  ];

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % carouselSteps.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, carouselSteps.length]);

  const nextStep = () => {
    setIsAutoPlaying(false);
    setCurrentStep((prev) => (prev + 1) % carouselSteps.length);
  };

  const prevStep = () => {
    setIsAutoPlaying(false);
    setCurrentStep(
      (prev) => (prev - 1 + carouselSteps.length) % carouselSteps.length
    );
  };

  const goToStep = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentStep(index);
  };

  const benefits = [
    {
      icon: <CheckCircle2 className="w-5 h-5" />,
      text: "Technology utilized by over 200 users across leading organizations, delivering measurable skill improvements and lasting behavior change",
      highlight: "200",
    },

    {
      icon: <Clock className="w-5 h-5" />,
      text: "25k+ minutes practiced — real conversations with measurable skill development and confidence building",
      highlight: "25k+",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      text: "Built to scale with your needs — from tough conversations today to offboarding and leadership tomorrow",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      text: "Practice-based learning, not passive content — employees learn by doing, not just watching",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Modern Header */}
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
                  onClick={() => handleNavClick("about")}
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  About Us
                </button>
                <button
                  onClick={() => handleNavClick("pricing")}
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Pricing
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleSignUpClick}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors px-4 py-2"
              >
                Sign Up
              </button>
              <button
                onClick={() => {
                  logNavigationClick("book_demo", "landing");
                  window.open(
                    "https://calendly.com/siladiea2005/learnloop-demo",
                    "_blank"
                  );
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Book Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Redesigned */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-[88rem] mx-auto px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Side - Text */}
            <div className="space-y-8 pl-12 lg:pl-20">
              <div className="space-y-6">
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Your People Deserve Trainings That Engage, Not Lecture
                </h1>

                <p className="text-xl text-gray-600 leading-relaxed">
                  Traditional training doesn&apos;t stick. LearnLoop transforms
                  how employees communicate — through custom, interactive,
                  AI-powered practice that turns theory into lasting behavior
                  change.
                </p>
              </div>
            </div>

            {/* Right Side - Image and Benefits */}
            <div className="space-y-8">
              {/* Image */}
              <div className="flex justify-center">
                <Image
                  src="/LP_Image.png"
                  alt="AI Training Assistant - Practice workplace conversations with AI"
                  width={400}
                  height={300}
                  className="w-full h-auto rounded-xl max-w-md object-cover"
                />
              </div>
            </div>
          </div>

          {/* Benefits - Centered Below Hero Content */}
          <div className="max-w-5xl mx-auto pt-16">
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-200">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-shrink-0 text-blue-600">
                    {benefit.icon}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    {benefit.highlight
                      ? benefit.text
                          .split(benefit.highlight)
                          .map((part, partIndex) => (
                            <span key={partIndex}>
                              {part}
                              {partIndex <
                                benefit.text.split(benefit.highlight).length -
                                  1 && (
                                <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent font-bold text-base">
                                  {benefit.highlight}
                                </span>
                              )}
                            </span>
                          ))
                      : benefit.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section - Carousel */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              How LearnLoop Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Our four-step process transforms your conversation skills through
              AI-powered practice and personalized feedback
            </p>
          </div>

          {/* Carousel Container */}
          <div className="relative max-w-4xl mx-auto">
            {/* Image Container */}
            <div className="relative">
              <div
                className="relative w-full overflow-hidden rounded-2xl"
                style={{ height: "400px" }}
              >
                <Image
                  src={carouselSteps[currentStep].image}
                  alt={carouselSteps[currentStep].title}
                  fill
                  className="object-contain rounded-2xl"
                  priority
                />
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={prevStep}
                className="absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110 focus:outline-none"
                aria-label="Previous step"
              >
                <ChevronLeft
                  className="w-10 h-10 text-gray-700 hover:text-blue-600"
                  strokeWidth={2.5}
                />
              </button>
              <button
                onClick={nextStep}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110 focus:outline-none"
                aria-label="Next step"
              >
                <ChevronRight
                  className="w-10 h-10 text-gray-700 hover:text-blue-600"
                  strokeWidth={2.5}
                />
              </button>
            </div>

            {/* Content Container */}
            <div className="mt-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {carouselSteps[currentStep].number}
                  </span>
                </div>
                <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
                  {carouselSteps[currentStep].title}
                </h3>
              </div>
              <p className="text-base text-gray-600 leading-relaxed max-w-2xl mx-auto">
                {carouselSteps[currentStep].description}
              </p>
            </div>

            {/* Progress Indicators */}
            <div className="flex items-center justify-center gap-3 mt-6">
              {carouselSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  className={`transition-all duration-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    index === currentStep
                      ? "w-12 h-3 bg-blue-600"
                      : "w-3 h-3 bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Email Subscription Section - Professional Design */}
      <section
        id="subscribe"
        className="py-12 lg:py-16 bg-gradient-to-br from-blue-50 via-white to-indigo-50"
      >
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl mb-6">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 max-w-3xl mx-auto leading-tight">
              Be Among the First to Transform Your Training
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Join our early access program and be the first to experience the
              future of workplace training
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 lg:p-12">
            <form onSubmit={handleEmailSubscription} className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    disabled={isSubmitting}
                    className="w-full px-6 py-4 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Subscribing...
                    </div>
                  ) : (
                    "Subscribe"
                  )}
                </button>
              </div>

              {/* Status Messages */}
              {subscriptionStatus === "success" && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-green-800 font-medium">
                    {subscriptionMessage}
                  </p>
                </div>
              )}

              {subscriptionStatus === "error" && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <p className="text-red-800 font-medium">
                    {subscriptionMessage}
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-500 text-center">
                Be part of our founding community and help shape the future of
                workplace training
                <br />
                <span className="font-medium">
                  No spam, unsubscribe at any time.
                </span>
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">L</span>
                </div>
                <span className="text-xl font-bold">LearnLoop</span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                AI-powered training simulations designed to help employees
                improve their communication skills and build better workplace
                relationships.
              </p>
              <div className="flex space-x-4">
                <a
                  href="https://calendly.com/siladiea2005/learnloop-demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    handleFooterLinkClick("company_info", "book_demo")
                  }
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Book Demo
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/about"
                    onClick={() =>
                      handleFooterLinkClick("quick_links", "about")
                    }
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <a
                    href="/pricing"
                    onClick={() =>
                      handleFooterLinkClick("quick_links", "pricing")
                    }
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    onClick={() =>
                      handleFooterLinkClick("quick_links", "contact")
                    }
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/terms-of-service"
                    onClick={() =>
                      handleFooterLinkClick("legal", "terms_of_service")
                    }
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy-policy"
                    onClick={() =>
                      handleFooterLinkClick("legal", "privacy_policy")
                    }
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:alex@learn-loop.org"
                    onClick={() => handleFooterLinkClick("legal", "support")}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Support
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-gray-400 text-sm">
                © 2025 LearnLoop LLC. All rights reserved.
              </p>
              <div className="flex space-x-6 text-sm text-gray-400">
                <a
                  href="mailto:alex@learn-loop.org"
                  className="hover:text-white transition-colors"
                >
                  alex@learn-loop.org
                </a>
                <a
                  href="mailto:ashok@learn-loop.org"
                  className="hover:text-white transition-colors"
                >
                  ashok@learn-loop.org
                </a>
              </div>
            </div>
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

export default LandingPage;
