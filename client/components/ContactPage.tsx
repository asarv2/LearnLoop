"use client";
import { useStatsigAnalytics } from "@/hooks/useStatsigAnalytics";
import { Clock, Mail, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const {
    logEvent,
    logNavigationClick,
    logCTAClick,
    logFormSubmission,
    STATSIG_EVENTS,
  } = useStatsigAnalytics();

  // Track page view on component mount
  useEffect(() => {
    logEvent(STATSIG_EVENTS.CONTACT_PAGE_VIEWED);
  }, [logEvent, STATSIG_EVENTS.CONTACT_PAGE_VIEWED]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFieldFocus = (fieldName: string) => {
    logEvent(STATSIG_EVENTS.CONTACT_FORM_FIELD_FOCUSED, { field: fieldName });
  };

  const handleNavClick = (destination: string) => {
    logNavigationClick(destination, "contact");
    window.open(`/${destination}`, "_self");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    // Log form submission attempt
    logEvent(STATSIG_EVENTS.CONTACT_FORM_SUBMITTED, {
      subject: formData.subject,
      has_company: !!formData.company,
    });

    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus("success");
        setSubmitMessage(
          "Thank you for your message! We'll get back to you within 24 hours."
        );
        setFormData({
          name: "",
          email: "",
          company: "",
          subject: "",
          message: "",
        });
        logFormSubmission("contact_form", true, {
          subject: formData.subject,
          company: formData.company,
        });
      } else {
        setSubmitStatus("error");
        setSubmitMessage(
          data.error || "Something went wrong. Please try again."
        );
        logFormSubmission("contact_form", false, {
          subject: formData.subject,
          company: formData.company,
          error: data.error,
        });
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMessage(
        "Network error. Please check your connection and try again."
      );
      logFormSubmission("contact_form", false, {
        subject: formData.subject,
        company: formData.company,
        error: "Network error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.name && formData.email && formData.subject && formData.message;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <button
                onClick={() => handleNavClick("")}
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
                <button
                  onClick={() => handleNavClick("contact")}
                  className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Contact
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  logCTAClick("sign_up", "contact");
                  window.open("/auth", "_self");
                }}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors px-4 py-2"
              >
                Sign Up
              </button>
              <button
                onClick={() => {
                  logNavigationClick("book_demo", "contact");
                  window.open(
                    "https://calendly.com/siladiea2005/learnloop-demo",
                    "_blank"
                  );
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Book Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Contact Us
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Have questions about LearnLoop? We&apos;d love to hear from you.
              Send us a message and we&apos;ll respond as soon as possible.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Get in Touch
                </h2>
                <p className="text-gray-600 mb-8">
                  Ready to transform your training? We&apos;re here to help you
                  get started with LearnLoop.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Email Us
                    </h3>
                    <p className="text-gray-600 mb-2">
                      Send us an email and we&apos;ll respond within 24 hours
                    </p>
                    <a
                      href="mailto:alex@learn-loop.org"
                      onClick={() =>
                        logEvent(STATSIG_EVENTS.CONTACT_INFO_EMAIL_CLICKED, {
                          email: "alex@learn-loop.org",
                        })
                      }
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      alex@learn-loop.org
                    </a>
                    <br />
                    <a
                      href="mailto:ashok@learn-loop.org"
                      onClick={() =>
                        logEvent(STATSIG_EVENTS.CONTACT_INFO_EMAIL_CLICKED, {
                          email: "ashok@learn-loop.org",
                        })
                      }
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      ashok@learn-loop.org
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Book a Demo
                    </h3>
                    <p className="text-gray-600 mb-2">
                      Schedule a personalized demo to see LearnLoop in action
                    </p>
                    <a
                      href="https://calendly.com/siladiea2005/learnloop-demo"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        logEvent(STATSIG_EVENTS.CONTACT_INFO_DEMO_CLICKED)
                      }
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Schedule Demo →
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Response Time
                    </h3>
                    <p className="text-gray-600">
                      We typically respond to inquiries within 24 hours during
                      business days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Company Information
                </h3>
                <div className="space-y-2 text-gray-600">
                  <p>
                    <strong>Company:</strong> LearnLoop LLC
                  </p>
                  <p>
                    <strong>Service:</strong> AI-Powered Training Platform
                  </p>
                  <p>
                    <strong>Founded:</strong> 2025
                  </p>
                  <p>
                    <strong>Location:</strong> San Ramon, CA, United States
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-gray-50 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Send us a Message
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-semibold text-gray-900 mb-2"
                    >
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus("name")}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-semibold text-gray-900 mb-2"
                    >
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus("email")}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="company"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
                    Company (Optional)
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    onFocus={() => handleFieldFocus("company")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Your company name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
                    Subject *
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    onFocus={() => handleFieldFocus("subject")}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="demo">Request Demo</option>
                    <option value="pricing">Pricing Information</option>
                    <option value="support">Technical Support</option>
                    <option value="partnership">Partnership Opportunity</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-semibold text-gray-900 mb-2"
                  >
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    onFocus={() => handleFieldFocus("message")}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                    placeholder="Tell us how we can help you..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 px-8 rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending Message...
                    </div>
                  ) : (
                    "Send Message"
                  )}
                </button>

                {/* Status Messages */}
                {submitStatus === "success" && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <p className="text-green-800 font-medium">
                      {submitMessage}
                    </p>
                  </div>
                )}

                {submitStatus === "error" && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                    <p className="text-red-800 font-medium">{submitMessage}</p>
                  </div>
                )}
              </form>
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
    </div>
  );
};

export default ContactPage;
