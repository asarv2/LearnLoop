"use client";

const TermsOfServicePage = () => {
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
                LearnLoop LLC — Terms of Service
              </h1>
              <p className="text-gray-600">Effective Date: January 2025</p>
            </div>

            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  1. Acceptance of Terms
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  Welcome to LearnLoop LLC ("LearnLoop," "we," "our," or "us").
                  These Terms of Service ("Terms") govern your access to and use
                  of LearnLoop's website (https://learn-loop.org), web
                  application, and related services (collectively, the
                  "Service").
                </p>
                <p className="text-gray-700 leading-relaxed">
                  By accessing or using LearnLoop, you ("Customer," "you," or
                  "your") agree to be bound by these Terms. If you are entering
                  into this agreement on behalf of a company or other legal
                  entity, you represent that you have the authority to bind that
                  entity to these Terms.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  If you do not agree with these Terms, you may not access or
                  use the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  2. Description of Service
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop provides AI-powered training simulations designed to
                  help employees improve their communication skills. LearnLoop
                  is a business-to-business (B2B) software platform that allows
                  organizations to create and manage employee training accounts
                  through a company access code.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  3. Eligibility and Accounts
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>
                    You must register an account to use LearnLoop. Accounts are
                    either created directly by a company administrator or joined
                    via a company access code.
                  </li>
                  <li>
                    You agree to provide accurate information and maintain the
                    security of your login credentials.
                  </li>
                  <li>
                    LearnLoop reserves the right to suspend or terminate any
                    account that violates these Terms.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  4. Company Access and Use
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  Each company ("Client") purchasing access to LearnLoop
                  receives an organization account and a unique company code
                  that employees may use to join. The Client is responsible for
                  all activity under its organization account and the actions of
                  its users.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  5. Subscriptions and Payments
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>
                    LearnLoop operates on yearly contracts unless otherwise
                    specified in writing.
                  </li>
                  <li>
                    Fees and payment schedules are agreed upon with each Client
                    before account activation.
                  </li>
                  <li>
                    Payments are processed through authorized third-party
                    payment processors.
                  </li>
                  <li>
                    All fees are non-refundable unless otherwise stated in the
                    written contract.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  6. Use of Artificial Intelligence (AI)
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop utilizes AI technologies, including but not limited
                  to OpenAI, Google Gemini, and Grok APIs, to deliver training
                  simulations and feedback. By using LearnLoop, you acknowledge
                  and consent to the use of AI in generating content, feedback,
                  and simulations.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  AI-generated content may not always be accurate or
                  appropriate. LearnLoop makes no guarantees regarding the
                  factual accuracy or suitability of AI outputs, and you agree
                  to use AI-generated responses at your own discretion.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  7. Data Retention and Privacy
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop collects and stores information including user
                  names, email addresses, company information, uploaded content,
                  chat data, voice recordings, and usage analytics. LearnLoop
                  retains this data indefinitely unless otherwise requested by
                  the Client.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  For more details on how data is collected, stored, and used,
                  please review our{" "}
                  <a
                    href="/privacy-policy"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  8. Prohibited Uses
                </h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  You agree not to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>use LearnLoop for unlawful purposes;</li>
                  <li>attempt to reverse engineer or copy the platform;</li>
                  <li>upload malware or malicious code;</li>
                  <li>
                    use the Service to harass, discriminate, or harm others;
                  </li>
                  <li>
                    access the platform in a way intended to overload or disrupt
                    its operations.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  9. Disclaimer of Warranties
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  The Service is provided "as is" and "as available." LearnLoop
                  makes no warranties or representations, express or implied,
                  including but not limited to warranties of merchantability,
                  fitness for a particular purpose, or non-infringement.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  10. Limitation of Liability
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  To the maximum extent permitted by law, LearnLoop and its
                  affiliates, officers, employees, and partners shall not be
                  liable for any indirect, incidental, special, or consequential
                  damages arising out of or in connection with your use of the
                  Service.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  LearnLoop's total cumulative liability shall not exceed the
                  total amount paid by the Client to LearnLoop in the twelve
                  (12) months preceding the event giving rise to the claim.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  11. Governing Law
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  These Terms are governed by the laws of the State of
                  California, without regard to its conflict of law principles.
                  All disputes arising out of or related to these Terms or the
                  Service shall be resolved by binding arbitration administered
                  by the American Arbitration Association ("AAA") under its
                  Commercial Arbitration Rules.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  12. Contact Information
                </h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                  For questions regarding these Terms, please contact us at:
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

export default TermsOfServicePage;
