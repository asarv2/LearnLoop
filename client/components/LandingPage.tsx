"use client";
import {
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Mic,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import Image from "next/image";
import React, { useState } from "react";
import AuthModal from "./auth/AuthModal";

// Mini scenario preview component - moved outside to prevent re-creation
const MiniScenarioPreview = ({
  previewScenario,
  setPreviewScenario,
  previewPosition,
  setPreviewPosition,
  previewPersonality,
  setPreviewPersonality,
}: {
  previewScenario: string;
  setPreviewScenario: (value: string) => void;
  previewPosition: string;
  setPreviewPosition: (value: string) => void;
  previewPersonality: string;
  setPreviewPersonality: (value: string) => void;
}) => {
  const scenarios = [
    "Employee Termination",
    "Performance Review",
    "Conflict Resolution",
    "Team Restructuring",
  ];

  const personalities = [
    "Defensive Employee",
    "Confused Employee",
    "Disappointed Employee",
    "Angry Employee",
  ];

  return (
    <div
      className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col"
      style={{ minHeight: "460px" }}
    >
      <div className="flex-1 flex flex-col justify-between">
        {/* Scenario Selection */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                previewScenario ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              {previewScenario ? (
                <CheckCircle2 className="w-3 h-3 text-white" />
              ) : (
                <span className="text-white text-xs font-bold">1</span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-gray-900">Scenario</h4>
          </div>
          <select
            value={previewScenario}
            onChange={(e) => setPreviewScenario(e.target.value)}
            className={`w-full p-2 border rounded text-sm outline-none transition-all ${
              previewScenario
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-white hover:border-gray-400"
            }`}
          >
            <option value="">Choose scenario...</option>
            {scenarios.map((scenario) => (
              <option key={scenario} value={scenario}>
                {scenario}
              </option>
            ))}
          </select>
        </div>

        {/* Position Selection */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                previewPosition ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              {previewPosition ? (
                <CheckCircle2 className="w-3 h-3 text-white" />
              ) : (
                <span className="text-white text-xs font-bold">2</span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-gray-900">
              Employee Role
            </h4>
          </div>
          <input
            type="text"
            placeholder="Enter role..."
            value={previewPosition}
            onChange={(e) => setPreviewPosition(e.target.value)}
            className={`w-full p-2 border rounded text-sm outline-none transition-all ${
              previewPosition
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-white hover:border-gray-400"
            }`}
          />
        </div>

        {/* Personality Selection */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                previewPersonality ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              {previewPersonality ? (
                <CheckCircle2 className="w-3 h-3 text-white" />
              ) : (
                <span className="text-white text-xs font-bold">3</span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-gray-900">Personality</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {personalities.map((personality, index) => {
              const isSelected = previewPersonality === personality;
              const colors = [
                "bg-blue-50 border-blue-300",
                "bg-purple-50 border-purple-300",
                "bg-orange-50 border-orange-300",
                "bg-red-50 border-red-300",
              ];
              const selectedColors = [
                "bg-blue-100 border-blue-500",
                "bg-purple-100 border-purple-500",
                "bg-orange-100 border-orange-500",
                "bg-red-100 border-red-500",
              ];

              return (
                <div
                  key={personality}
                  onClick={() => setPreviewPersonality(personality)}
                  className={`p-3 border-2 rounded cursor-pointer transition-all ${
                    isSelected ? selectedColors[index] : colors[index]
                  } hover:shadow-sm`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-400"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 text-xs">
                      {personality}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini chat preview component for step 2
const MiniChatPreview = () => {
  const [showMessages, setShowMessages] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const messages = React.useMemo(
    () => [
      { role: "employee", content: "Hi, how are you?", delay: 1000 },
      {
        role: "user",
        content: "I have something important to tell you",
        delay: 2000,
      },
      { role: "employee", content: "What's up?", delay: 1500 },
      {
        role: "user",
        content: "I'm sorry but we have to let you go",
        delay: 2500,
      },
    ],
    []
  );

  // Start animation when component mounts
  React.useEffect(() => {
    const timer = setTimeout(() => setShowMessages(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Animate messages one by one
  React.useEffect(() => {
    if (!showMessages) return;

    const showNextMessage = () => {
      if (currentMessageIndex < messages.length) {
        const timer = setTimeout(() => {
          setCurrentMessageIndex((prev) => prev + 1);
        }, messages[currentMessageIndex]?.delay || 1000);
        return timer;
      }
    };

    const timer = showNextMessage();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showMessages, currentMessageIndex, messages]);

  return (
    <div
      className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col"
      style={{ minHeight: "460px" }}
    >
      {/* Chat Messages Area - Extended */}
      <div className="bg-gray-50 rounded-lg p-4 flex-1 overflow-hidden mb-4">
        <div className="space-y-3">
          {messages.slice(0, currentMessageIndex).map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              } animate-fadeIn`}
            >
              <div className="flex items-start gap-2 max-w-[85%]">
                {message.role === "employee" && (
                  <div className="w-6 h-6 rounded-full bg-green-100 border border-green-300 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3 h-3 text-green-600" />
                  </div>
                )}
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
                    message.role === "user"
                      ? "bg-blue-100 border border-blue-300 text-blue-900"
                      : "bg-white border border-gray-300 text-gray-900"
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-75">
                    {message.role === "user" ? "You" : "Employee"}
                  </div>
                  {message.content}
                </div>
                {message.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center flex-shrink-0">
                    <Users className="w-3 h-3 text-blue-600" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Control Buttons - Moved to Bottom */}
      <div className="mt-auto">
        <div className="flex items-center justify-center gap-3">
          {/* Hold to Speak Button */}
          <button
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 cursor-not-allowed opacity-75"
            disabled
          >
            <Mic className="w-4 h-4" />
            Hold to Speak
          </button>

          {/* Hints Button */}
          <button
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 cursor-not-allowed opacity-75"
            disabled
          >
            Hints
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

// Mini feedback preview component for step 4
const MiniFeedbackPreview = () => {
  const [currentTab, setCurrentTab] = useState(0);

  const tabs = [
    {
      title: "Score",
      icon: "📊",
      content: (
        <div className="p-6 h-full flex flex-col">
          {/* Mock Score Display */}
          <div className="text-center space-y-3 mb-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full">
              <span className="text-2xl font-bold text-blue-600">87</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Overall Score
              </h3>
              <p className="text-sm text-gray-600">Performance Rating</p>
            </div>
          </div>

          {/* Mock Standards */}
          <div className="flex-1 space-y-2">
            <h4 className="font-medium text-gray-900">Standards</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 border border-gray-200 rounded">
                <span className="text-sm text-gray-700">Communication</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                  4/5
                </span>
              </div>
              <div className="flex items-center justify-between p-2 border border-gray-200 rounded">
                <span className="text-sm text-gray-700">Empathy</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                  5/5
                </span>
              </div>
              <div className="flex items-center justify-between p-2 border border-gray-200 rounded">
                <span className="text-sm text-gray-700">Clarity</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                  4/5
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Strengths",
      icon: "✓",
      content: (
        <div className="p-6 h-full flex flex-col justify-center">
          <div className="space-y-3">
            <div className="relative p-4 bg-white border-l-4 border-green-500 rounded-lg shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  You demonstrated excellent empathy when delivering the
                  difficult news
                </p>
              </div>
            </div>
            <div className="relative p-4 bg-white border-l-4 border-green-500 rounded-lg shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Your communication was clear and direct throughout the
                  conversation
                </p>
              </div>
            </div>
            <div className="relative p-4 bg-white border-l-4 border-green-500 rounded-lg shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  You maintained a professional tone while being compassionate
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Improve",
      icon: "⚡",
      content: (
        <div className="p-6 h-full flex flex-col justify-center">
          <div className="space-y-3">
            <div className="relative p-4 bg-white border-l-4 border-amber-500 rounded-lg shadow-sm">
              <p className="text-sm text-gray-700 leading-relaxed">
                Consider providing more context about next steps or support
                available
              </p>
            </div>
            <div className="relative p-4 bg-white border-l-4 border-amber-500 rounded-lg shadow-sm">
              <p className="text-sm text-gray-700 leading-relaxed">
                Allow more time for the employee to process and ask questions
              </p>
            </div>
            <div className="relative p-4 bg-white border-l-4 border-amber-500 rounded-lg shadow-sm">
              <p className="text-sm text-gray-700 leading-relaxed">
                Practice acknowledging emotional responses with more specific
                validation
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col"
      style={{ minHeight: "460px" }}
    >
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex overflow-hidden">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setCurrentTab(index)}
              className={`flex-1 px-2 py-3 text-xs font-medium transition-all truncate ${
                currentTab === index
                  ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto" style={{ height: "300px" }}>
        {tabs[currentTab].content}
      </div>
    </div>
  );
};

const LandingPage = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Mini scenario preview state
  const [previewScenario, setPreviewScenario] = useState("");
  const [previewPosition, setPreviewPosition] = useState("");
  const [previewPersonality, setPreviewPersonality] = useState("");

  // Email subscription state
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");

  const handleGetStarted = () => {
    setAuthMode("signup");
    setAuthModalOpen(true);
  };

  const handleEmailSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubscriptionStatus("idle");

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
      } else {
        setSubscriptionStatus("error");
        setSubscriptionMessage(
          data.error || "Something went wrong. Please try again."
        );
      }
    } catch {
      setSubscriptionStatus("error");
      setSubscriptionMessage(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const processSteps = [
    {
      number: "01",
      title: "Set Up Your Scenario",
      description:
        "Choose the type of conversation you want to practice and customize the AI personality to match your needs.",
      icon: <Target className="w-6 h-6" />,
    },
    {
      number: "02",
      title: "Have a Voice Conversation",
      description:
        "Engage in a realistic conversation with AI that responds naturally to your words and tone.",
      icon: <Mic className="w-6 h-6" />,
    },
    {
      number: "03",
      title: "Get Feedback & Improve",
      description:
        "Receive a detailed score breakdown and personalized feedback to help you improve for next time.",
      icon: <TrendingUp className="w-6 h-6" />,
    },
  ];

  const benefits = [
    {
      icon: <CheckCircle2 className="w-5 h-5" />,
      text: "Technology utilized by over 200 users across leading organizations, delivering measurable skill improvements and lasting behavior change",
      highlight: "200",
    },

    {
      icon: <Clock className="w-5 h-5" />,
      text: "50k+ minutes practiced — real conversations with measurable skill development and confidence building",
      highlight: "50k+",
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
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <span className="text-xl font-bold text-gray-900">LearnLoop</span>
            </div>

            <div className="flex items-center space-x-4">
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
              <button
                onClick={handleGetStarted}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Get Started
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
                  how employees build skills — through custom, interactive,
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

      {/* How It Works Section - Enhanced */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              How LearnLoop Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Our three-step process transforms your conversation skills through
              AI-powered practice and personalized feedback
            </p>
          </div>

          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {processSteps.map((step, index) => (
              <div key={index} className="relative group">
                <div className="bg-white border-2 border-gray-100 rounded-2xl p-8 hover:border-blue-200 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300">
                      {step.icon}
                    </div>
                    <span className="text-3xl font-bold text-blue-100 group-hover:text-blue-200 transition-colors">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Interactive Preview for Step 1 */}
                {index === 0 && (
                  <div className="mt-6">
                    <MiniScenarioPreview
                      previewScenario={previewScenario}
                      setPreviewScenario={setPreviewScenario}
                      previewPosition={previewPosition}
                      setPreviewPosition={setPreviewPosition}
                      previewPersonality={previewPersonality}
                      setPreviewPersonality={setPreviewPersonality}
                    />
                  </div>
                )}

                {/* Chat Preview for Step 2 */}
                {index === 1 && (
                  <div className="mt-6">
                    <MiniChatPreview />
                  </div>
                )}

                {/* Feedback Preview for Step 3 */}
                {index === 2 && (
                  <div className="mt-6">
                    <MiniFeedbackPreview />
                  </div>
                )}

                {/* Connection Line */}
                {index < processSteps.length - 1 && (
                  <div className="hidden xl:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-200 to-transparent transform -translate-y-1/2"></div>
                )}
              </div>
            ))}
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

      {/* Footer - Simplified */}
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

export default LandingPage;
