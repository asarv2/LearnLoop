"use client";

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
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
                onClick={() => window.open("/contact", "_self")}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Contact
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="prose prose-lg prose-gray max-w-none">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                LearnLoop LLC — Privacy Policy
              </h1>
              <p className="text-gray-600">Effective Date: January 2025</p>
            </div>

            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  1. Introduction
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop LLC ("LearnLoop," "we," "our," or "us") respects
                  your privacy and is committed to protecting your personal
                  data. This Privacy Policy explains how we collect, use,
                  disclose, and safeguard your information when you visit our
                  website (https://learn-loop.org), use our platform, or
                  interact with our services (collectively, the "Service").
                </p>
                <p className="text-gray-700 leading-relaxed">
                  By using LearnLoop, you agree to the terms of this Privacy
                  Policy. If you do not agree, please do not use our Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  2. Information We Collect
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We collect information in the following categories:
                </p>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  2.1 Personal Information
                </h3>
                <p className="text-gray-700 leading-relaxed mb-3">
                  When you or your company create an account with LearnLoop, we
                  may collect:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                  <li>Full name</li>
                  <li>Email address</li>
                  <li>Company name and role/title</li>
                  <li>Account credentials</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  2.2 Usage and Device Information
                </h3>
                <p className="text-gray-700 leading-relaxed mb-3">
                  We automatically collect certain information about your use of
                  LearnLoop, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                  <li>IP address and browser type</li>
                  <li>Device identifiers</li>
                  <li>Log and usage data</li>
                  <li>Cookies and analytics data</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  2.3 User Content and Uploads
                </h3>
                <p className="text-gray-700 leading-relaxed mb-3">
                  During use of LearnLoop, you and your organization may upload
                  or create:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                  <li>Audio or voice recordings</li>
                  <li>Text entries, messages, or chat responses</li>
                  <li>Uploaded documents or training materials</li>
                  <li>Generated conversation transcripts and AI responses</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  2.4 Payment and Billing Information
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  For Clients under yearly contracts, payment information may be
                  processed through our third-party payment processors.
                  LearnLoop does not store or process credit card details
                  directly.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  3. How We Use Your Information
                </h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  We use collected information to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Provide, operate, and maintain the LearnLoop platform</li>
                  <li>Personalize and improve the training experience</li>
                  <li>
                    Facilitate account creation and company access management
                  </li>
                  <li>Provide technical support and respond to inquiries</li>
                  <li>Analyze platform usage to enhance performance</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  4. Use of Artificial Intelligence (AI)
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop uses AI systems (including APIs from OpenAI, Google
                  Gemini, and Grok) to power communication simulations, provide
                  feedback, and analyze user interactions.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Your text, voice data, and uploaded content may be processed
                  by these AI systems to generate training responses. LearnLoop
                  does not sell your data to third parties or use your data to
                  train external AI models. All processing is conducted solely
                  for the purpose of delivering and improving LearnLoop's
                  Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  5. Data Retention
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop retains data indefinitely unless deletion is
                  requested by the Client. This includes user profiles, content
                  created during training, and uploaded materials. Clients may
                  contact us to request deletion of data from their
                  organization's account.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  6. How We Share Information
                </h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  We may share information in the following ways:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                  <li>
                    With third-party service providers that help us operate our
                    platform (e.g., hosting providers, AI APIs, analytics
                    services, and payment processors)
                  </li>
                  <li>
                    With your organization's administrator for account
                    management
                  </li>
                  <li>As required by law, regulation, or court order</li>
                  <li>
                    In connection with a merger, acquisition, or sale of assets
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed">
                  We do not sell or rent your personal data to third parties.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  7. Data Security
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  We implement reasonable administrative, technical, and
                  physical safeguards to protect your data from unauthorized
                  access, loss, misuse, or disclosure. However, no system is
                  completely secure, and we cannot guarantee absolute data
                  security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  8. Your Rights and Choices
                </h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  Depending on your location, you may have rights to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                  <li>Access, correct, or delete your personal data</li>
                  <li>Restrict or object to processing</li>
                  <li>Request data portability</li>
                  <li>Withdraw consent for certain uses of your information</li>
                </ul>
                <p className="text-gray-700 leading-relaxed">
                  To exercise these rights, please contact us at{" "}
                  <a
                    href="mailto:alex@learnloop.org"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    alex@learnloop.org
                  </a>{" "}
                  or{" "}
                  <a
                    href="mailto:ashok@learnloop.org"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    ashok@learnloop.org
                  </a>
                  .
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  9. Children's Privacy
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop is not directed toward individuals under 13. We do
                  not knowingly collect personal data from children. If we learn
                  that a child under 13 has provided personal information, we
                  will take steps to delete it.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  10. Changes to This Policy
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop may update this Privacy Policy from time to time. We
                  will notify users of material changes by email or through
                  notices on our website. The "Effective Date" at the top of
                  this document will always reflect the latest version.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  11. Contact Us
                </h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  If you have any questions or concerns about this Privacy
                  Policy, please contact us at:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>
                    <strong>Email:</strong>{" "}
                    <a
                      href="mailto:alex@learnloop.org"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      alex@learnloop.org
                    </a>
                    ,{" "}
                    <a
                      href="mailto:ashok@learnloop.org"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      ashok@learnloop.org
                    </a>
                  </li>
                  <li>
                    <strong>Website:</strong>{" "}
                    <a
                      href="https://learn-loop.org"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      https://learn-loop.org
                    </a>
                  </li>
                </ul>
              </section>

              <div className="pt-8 border-t border-gray-200">
                <p className="text-gray-600 text-sm">
                  <strong>Last Updated:</strong> January 2025
                </p>
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
    </div>
  );
};

export default PrivacyPolicyPage;
