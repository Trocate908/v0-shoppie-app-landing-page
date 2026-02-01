export const metadata = {
  title: "Terms and Conditions - ShoppieApp",
  description: "Terms and Conditions for using ShoppieApp platform",
}

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="ShoppieApp" className="h-8 w-8" />
              <h1 className="text-xl font-bold text-foreground">ShoppieApp</h1>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Terms and Conditions</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: December 30, 2024</p>

          <div className="mt-8 space-y-6 text-foreground">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-semibold">1. Introduction</h2>
              <p className="mt-2 text-muted-foreground">
                Welcome to ShoppieApp. These Terms and Conditions ("Terms") govern your access to and use of the
                ShoppieApp platform, website, and services (collectively, the "Platform"). By accessing or using our
                Platform, you agree to be bound by these Terms. If you do not agree with any part of these Terms, please
                do not use our Platform.
              </p>
            </section>

            {/* Definitions */}
            <section>
              <h2 className="text-xl font-semibold">2. Definitions</h2>
              <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
                <li>
                  <strong>"Platform"</strong> refers to the ShoppieApp website, mobile application, and all associated
                  services.
                </li>
                <li>
                  <strong>"Vendor"</strong> refers to individuals or businesses who register to sell products through
                  the Platform.
                </li>
                <li>
                  <strong>"Buyer"</strong> refers to individuals who browse and purchase products through the Platform.
                </li>
                <li>
                  <strong>"User"</strong> refers to any person who accesses or uses the Platform, including Vendors and
                  Buyers.
                </li>
                <li>
                  <strong>"Content"</strong> refers to text, images, product listings, and any other material posted on
                  the Platform.
                </li>
              </ul>
            </section>

            {/* Eligibility */}
            <section>
              <h2 className="text-xl font-semibold">3. Eligibility</h2>
              <p className="mt-2 text-muted-foreground">
                You must be at least 18 years old to use our Platform. By using the Platform, you represent and warrant
                that you have the legal capacity to enter into these Terms. If you are using the Platform on behalf of a
                business or organization, you represent that you have the authority to bind that entity to these Terms.
              </p>
            </section>

            {/* Account Registration */}
            <section>
              <h2 className="text-xl font-semibold">4. Account Registration</h2>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  <strong>4.1 Account Creation:</strong> Vendors must register for an account to list and sell products.
                  Buyers may browse without an account but may need to create one for certain features.
                </p>
                <p>
                  <strong>4.2 Account Information:</strong> You agree to provide accurate, current, and complete
                  information during registration and to update such information to keep it accurate and current.
                </p>
                <p>
                  <strong>4.3 Account Security:</strong> You are responsible for maintaining the confidentiality of your
                  account credentials and for all activities that occur under your account. You must notify us
                  immediately of any unauthorized use of your account.
                </p>
                <p>
                  <strong>4.4 Account Termination:</strong> We reserve the right to suspend or terminate your account at
                  any time if we believe you have violated these Terms or engaged in fraudulent or illegal activities.
                </p>
              </div>
            </section>

            {/* Vendor Obligations */}
            <section>
              <h2 className="text-xl font-semibold">5. Vendor Obligations</h2>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  <strong>5.1 Product Listings:</strong> Vendors are responsible for the accuracy of all product
                  listings, including descriptions, prices, images, and availability. Products must be legal and comply
                  with all applicable laws and regulations.
                </p>
                <p>
                  <strong>5.2 Pricing:</strong> Vendors must ensure that all prices listed are accurate and include all
                  applicable taxes and fees. Any price changes must be clearly communicated.
                </p>
                <p>
                  <strong>5.3 Inventory Management:</strong> Vendors must keep their inventory information up to date
                  and mark products as out of stock when unavailable.
                </p>
                <p>
                  <strong>5.4 Customer Service:</strong> Vendors are responsible for handling customer inquiries,
                  resolving disputes, and providing customer support related to their products.
                </p>
                <p>
                  <strong>5.5 Prohibited Items:</strong> Vendors may not list illegal items, counterfeit goods, stolen
                  property, hazardous materials, or any items that violate intellectual property rights.
                </p>
              </div>
            </section>

            {/* Buyer Responsibilities */}
            <section>
              <h2 className="text-xl font-semibold">6. Buyer Responsibilities</h2>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  <strong>6.1 Direct Communication:</strong> Buyers communicate directly with Vendors through the
                  Platform to complete purchases. ShoppieApp facilitates connections but is not a party to transactions
                  between Buyers and Vendors.
                </p>
                <p>
                  <strong>6.2 Product Verification:</strong> Buyers should verify product details, prices, and
                  availability with Vendors before making purchases.
                </p>
                <p>
                  <strong>6.3 Disputes:</strong> Buyers must work directly with Vendors to resolve any issues with
                  products or transactions.
                </p>
              </div>
            </section>

            {/* Platform Services */}
            <section>
              <h2 className="text-xl font-semibold">7. Platform Services</h2>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  <strong>7.1 Marketplace Role:</strong> ShoppieApp acts as a marketplace platform connecting Vendors
                  and Buyers. We do not own, sell, or control the products listed by Vendors.
                </p>
                <p>
                  <strong>7.2 No Transaction Party:</strong> ShoppieApp is not a party to transactions between Vendors
                  and Buyers. We do not guarantee the quality, safety, or legality of products, the accuracy of
                  listings, or the ability of Vendors to complete sales.
                </p>
                <p>
                  <strong>7.3 Location Services:</strong> Our Platform provides location-based search features to help
                  Buyers find products near them. Location data may be collected and used to improve service quality.
                </p>
              </div>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-xl font-semibold">8. Intellectual Property</h2>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  <strong>8.1 Platform Content:</strong> All content on the Platform, including logos, text, graphics,
                  and software, is owned by ShoppieApp or its licensors and is protected by intellectual property laws.
                </p>
                <p>
                  <strong>8.2 User Content:</strong> You retain ownership of content you post on the Platform. By
                  posting content, you grant ShoppieApp a non-exclusive, worldwide, royalty-free license to use,
                  display, and distribute your content on the Platform.
                </p>
                <p>
                  <strong>8.3 Copyright Infringement:</strong> We respect intellectual property rights. If you believe
                  your copyright has been infringed, please contact us with details of the alleged infringement.
                </p>
              </div>
            </section>

            {/* Privacy and Data Protection */}
            <section>
              <h2 className="text-xl font-semibold">9. Privacy and Data Protection</h2>
              <p className="mt-2 text-muted-foreground">
                Your use of the Platform is also governed by our Privacy Policy. We collect, use, and protect your
                personal information in accordance with applicable data protection laws. By using the Platform, you
                consent to our collection and use of your information as described in our Privacy Policy.
              </p>
            </section>

            {/* Prohibited Activities */}
            <section>
              <h2 className="text-xl font-semibold">10. Prohibited Activities</h2>
              <p className="mt-2 text-muted-foreground">You agree not to:</p>
              <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the intellectual property rights of others</li>
                <li>Post false, misleading, or fraudulent content</li>
                <li>Engage in any form of spam or unsolicited advertising</li>
                <li>Attempt to gain unauthorized access to the Platform or other user accounts</li>
                <li>Use automated systems or bots to access the Platform</li>
                <li>Interfere with or disrupt the Platform's functionality</li>
                <li>Collect or harvest user data without consent</li>
                <li>Impersonate any person or entity</li>
                <li>Post harmful, offensive, or inappropriate content</li>
              </ul>
            </section>

            {/* Disclaimer of Warranties */}
            <section>
              <h2 className="text-xl font-semibold">11. Disclaimer of Warranties</h2>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER
                  EXPRESS OR IMPLIED. SHOPPIEAPP DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED
                  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
                <p>
                  SHOPPIEAPP DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT
                  DEFECTS WILL BE CORRECTED. YOU USE THE PLATFORM AT YOUR OWN RISK.
                </p>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-xl font-semibold">12. Limitation of Liability</h2>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, SHOPPIEAPP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                  SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED
                  DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
                </p>
                <p>
                  SHOPPIEAPP'S TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM YOUR USE OF THE PLATFORM SHALL NOT
                  EXCEED THE AMOUNT YOU PAID TO SHOPPIEAPP IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS
                  GREATER.
                </p>
              </div>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className="text-xl font-semibold">13. Indemnification</h2>
              <p className="mt-2 text-muted-foreground">
                You agree to indemnify, defend, and hold harmless ShoppieApp, its affiliates, officers, directors,
                employees, and agents from any claims, liabilities, damages, losses, costs, or expenses (including
                reasonable attorneys' fees) arising from your use of the Platform, violation of these Terms, or
                infringement of any third-party rights.
              </p>
            </section>

            {/* Dispute Resolution */}
            <section>
              <h2 className="text-xl font-semibold">14. Dispute Resolution</h2>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  <strong>14.1 Vendor-Buyer Disputes:</strong> Disputes between Vendors and Buyers must be resolved
                  directly between the parties. ShoppieApp is not responsible for mediating or resolving such disputes.
                </p>
                <p>
                  <strong>14.2 Platform Disputes:</strong> Any disputes arising from your use of the Platform shall be
                  resolved through good faith negotiations. If negotiations fail, disputes may be subject to binding
                  arbitration or litigation in accordance with applicable laws.
                </p>
              </div>
            </section>

            {/* Modifications to Terms */}
            <section>
              <h2 className="text-xl font-semibold">15. Modifications to Terms</h2>
              <p className="mt-2 text-muted-foreground">
                We reserve the right to modify these Terms at any time. Changes will be effective immediately upon
                posting to the Platform. Your continued use of the Platform after changes are posted constitutes your
                acceptance of the modified Terms. We encourage you to review these Terms periodically.
              </p>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-xl font-semibold">16. Termination</h2>
              <p className="mt-2 text-muted-foreground">
                We may terminate or suspend your access to the Platform at any time, with or without cause, and with or
                without notice. Upon termination, your right to use the Platform will immediately cease. Provisions of
                these Terms that by their nature should survive termination shall survive, including ownership
                provisions, warranty disclaimers, and limitations of liability.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-xl font-semibold">17. Governing Law</h2>
              <p className="mt-2 text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which
                ShoppieApp operates, without regard to its conflict of law provisions.
              </p>
            </section>

            {/* Contact Information */}
            <section>
              <h2 className="text-xl font-semibold">18. Contact Information</h2>
              <p className="mt-2 text-muted-foreground">
                If you have any questions about these Terms and Conditions, please contact us through the Platform or at
                our designated support channels.
              </p>
            </section>

            {/* Severability */}
            <section>
              <h2 className="text-xl font-semibold">19. Severability</h2>
              <p className="mt-2 text-muted-foreground">
                If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall
                remain in full force and effect. The invalid or unenforceable provision shall be replaced with a valid
                provision that most closely reflects the intent of the original provision.
              </p>
            </section>

            {/* Entire Agreement */}
            <section>
              <h2 className="text-xl font-semibold">20. Entire Agreement</h2>
              <p className="mt-2 text-muted-foreground">
                These Terms, together with our Privacy Policy and any other policies or agreements referenced herein,
                constitute the entire agreement between you and ShoppieApp regarding your use of the Platform and
                supersede all prior agreements and understandings.
              </p>
            </section>

            {/* Acknowledgment */}
            <section className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground">
                By using ShoppieApp, you acknowledge that you have read, understood, and agree to be bound by these
                Terms and Conditions.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">&copy; 2025 ShoppieApp. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms & Conditions
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
