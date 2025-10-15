"use client";
import { ArrowRight, Building, CreditCard, Mail, User } from "lucide-react";
import { useState } from "react";
import AuthModal from "./auth/AuthModal";

const GetStartedPage = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  const [formData, setFormData] = useState({
    companyName: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    employeeFirstName: "",
    employeeLastName: "",
    employeePosition: "",
    employeeEmail: "",
    pricingPlan: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const pricingPlans = [
    { value: "starter", label: "Starter - $5,000/year (50 users)" },
    { value: "growth", label: "Growth - $8,000/year (100 users)" },
    { value: "professional", label: "Professional - $15,000/year (250 users)" },
    { value: "scale", label: "Scale - $25,000/year (500 users)" },
    { value: "enterprise", label: "Enterprise - Custom Pricing (500+ users)" },
  ];

  const handleSignUp = () => {
    setAuthMode("signup");
    setAuthModalOpen(true);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const response = await fetch("/api/v1/get-started", {
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
          "Thank you! We&apos;ll be in touch soon to get you started with LearnLoop."
        );
        setFormData({
          companyName: "",
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
          employeeFirstName: "",
          employeeLastName: "",
          employeePosition: "",
          employeeEmail: "",
          pricingPlan: "",
        });
      } else {
        setSubmitStatus("error");
        setSubmitMessage(
          data.error || "Something went wrong. Please try again."
        );
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMessage(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.companyName &&
    formData.street &&
    formData.city &&
    formData.state &&
    formData.zipCode &&
    formData.country &&
    formData.employeeFirstName &&
    formData.employeeLastName &&
    formData.employeePosition &&
    formData.employeeEmail &&
    formData.pricingPlan;

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
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Pricing
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleSignUp}
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

      {/* Main Content */}
      <section className="py-20 lg:py-28">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Get Started with LearnLoop
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Ready to transform your training? Let&apos;s get you set up with
              the perfect plan for your organization.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 lg:p-12">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Company Name */}
              <div>
                <label
                  htmlFor="companyName"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    Company Name
                  </div>
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your company name"
                />
              </div>

              {/* Company Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    Company Address
                  </div>
                </label>

                <div className="space-y-4">
                  {/* Street Address */}
                  <div>
                    <label
                      htmlFor="street"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="street"
                      name="street"
                      value={formData.street}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="123 Main Street"
                    />
                  </div>

                  {/* City and State */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="city"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        City
                      </label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="New York"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="state"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        State/Province
                      </label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="NY"
                      />
                    </div>
                  </div>

                  {/* Zip Code and Country */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="zipCode"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        ZIP/Postal Code
                      </label>
                      <input
                        type="text"
                        id="zipCode"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="10001"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="country"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Country
                      </label>
                      <input
                        type="text"
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="United States"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Employee Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="employeeFirstName"
                    className="block text-sm font-semibold text-gray-900 mb-3"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      First Name
                    </div>
                  </label>
                  <input
                    type="text"
                    id="employeeFirstName"
                    name="employeeFirstName"
                    value={formData.employeeFirstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="employeeLastName"
                    className="block text-sm font-semibold text-gray-900 mb-3"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Last Name
                    </div>
                  </label>
                  <input
                    type="text"
                    id="employeeLastName"
                    name="employeeLastName"
                    value={formData.employeeLastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Last name"
                  />
                </div>
              </div>

              {/* Employee Position */}
              <div>
                <label
                  htmlFor="employeePosition"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Employee Position
                  </div>
                </label>
                <input
                  type="text"
                  id="employeePosition"
                  name="employeePosition"
                  value={formData.employeePosition}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., HR Manager, Training Director, CEO"
                />
              </div>

              {/* Employee Email */}
              <div>
                <label
                  htmlFor="employeeEmail"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    Employee Email
                  </div>
                </label>
                <input
                  type="email"
                  id="employeeEmail"
                  name="employeeEmail"
                  value={formData.employeeEmail}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="employee@company.com"
                />
              </div>

              {/* Pricing Plan */}
              <div>
                <label
                  htmlFor="pricingPlan"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    Select Pricing Plan
                  </div>
                </label>
                <select
                  id="pricingPlan"
                  name="pricingPlan"
                  value={formData.pricingPlan}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Choose your plan...</option>
                  {pricingPlans.map((plan) => (
                    <option key={plan.value} value={plan.value}>
                      {plan.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 px-8 rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Request
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              {/* Status Messages */}
              {submitStatus === "success" && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <p className="text-green-800 font-medium">{submitMessage}</p>
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

              <p className="text-sm text-gray-500 text-center pt-4">
                By submitting this form, you agree to our{" "}
                <a
                  href="/terms-of-service"
                  className="text-blue-600 hover:text-blue-700 underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy-policy"
                  className="text-blue-600 hover:text-blue-700 underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                . We&apos;ll contact you shortly to discuss your LearnLoop
                implementation.
              </p>
            </form>
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

export default GetStartedPage;
