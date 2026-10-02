import { Link, useSearchParams } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";

const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "definitions", label: "Definitions" },
  { id: "user-responsibilities", label: "User Responsibilities" },
  { id: "producer-obligations", label: "Producer Obligations" },
  { id: "buyer-obligations", label: "Buyer Obligations" },
  { id: "transactions-payments", label: "Transactions & Payments" },
  { id: "ai-disclaimer", label: "AI Recognition Disclaimer" },
  { id: "privacy", label: "Privacy & Data Protection" },
  { id: "limitation", label: "Limitation of Liability" },
  { id: "termination", label: "Termination" },
  { id: "governing-law", label: "Governing Law" },
];

export default function Terms() {
  const [searchParams] = useSearchParams();
  const fromAccount = searchParams.get("from") === "account";

  return (
    <div className="terms-page">
      <header className="terms-header">
        <Link to="/" className="terms-header-logo">
          <img src={ecoLoopLogo} alt="EcoLoop" />
        </Link>
        <nav className="terms-header-nav">
          <Link to="/">Home</Link>
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/about">About</Link>
        </nav>
        <Link to="/login" className="btn btn-primary terms-login-btn">
          Login
        </Link>
      </header>

      <div className="terms-hero">
        <h1 className="terms-title">Terms & Conditions</h1>
        <p className="terms-subtitle">
          Please read these terms carefully before using EcoLoop services.
        </p>
      </div>

      <div className="terms-body">
        <aside className="terms-sidebar">
          <h2 className="terms-sidebar-title">Introduction</h2>
          <nav className="terms-sidebar-nav" aria-label="Terms sections">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={"terms-sidebar-link " + (section.id === "introduction" ? "terms-sidebar-link-active" : "")}
              >
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="terms-content">
          <section id="introduction" className="terms-section">
            <h2 className="terms-section-heading">1. Introduction</h2>
            <p>
              Welcome to EcoLoop. These Terms and Conditions govern your use of our SaaS marketplace platform. By accessing or using EcoLoop, you agree to be bound by these terms.
            </p>
            <p>
              EcoLoop is a circular economy marketplace designed to connect producers and buyers of sustainable materials. Our platform facilitates the listing, discovery, and transaction of recycled or upcycled assets.
            </p>
          </section>

          <section id="definitions" className="terms-section">
            <h2 className="terms-section-heading">2. Definitions</h2>
            <p>
              <strong>Platform</strong> refers to the EcoLoop website, software, and services.
            </p>
            <p>
              <strong>User</strong> refers to any individual or entity registered on the platform.
            </p>
            <p>
              <strong>Asset</strong> refers to the materials, products, or waste streams listed for exchange or sale.
            </p>
          </section>

          <section id="user-responsibilities" className="terms-section">
            <h2 className="terms-section-heading">3. User Responsibilities</h2>
            <p>
              Users must provide accurate, current, and complete information during the registration process. You are responsible for maintaining the confidentiality of your account credentials.
            </p>
            <ul>
              <li>Compliance with local laws and regulations.</li>
              <li>Ensuring that uploaded content does not violate intellectual property rights.</li>
              <li>Maintaining professional conduct within the marketplace.</li>
            </ul>
          </section>

          <section id="producer-obligations" className="terms-section">
            <h2 className="terms-section-heading">4. Producer Obligations</h2>
            <p>
              Producers must accurately describe the condition, quantity, and source of materials. Any certifications (e.g., ISO, FSC) must be valid and verifiable.
            </p>
          </section>

          <section id="buyer-obligations" className="terms-section">
            <h2 className="terms-section-heading">5. Buyer Obligations</h2>
            <p>
              Buyers are responsible for verifying material specifications and quality before completing transactions. Payment obligations must be met according to agreed terms.
            </p>
          </section>

          <section id="transactions-payments" className="terms-section">
            <h2 className="terms-section-heading">6. Transactions & Payments</h2>
            <p>
              All transactions conducted through the platform are subject to our payment and escrow policies. Fees and payment schedules are as specified at the time of listing or agreement.
            </p>
          </section>

          <section id="ai-disclaimer" className="terms-section">
            <h2 className="terms-section-heading">7. AI Recognition Disclaimer</h2>
            <div className="terms-disclaimer-box">
              <p>
                EcoLoop utilizes AI-driven image recognition to assist in categorizing and verifying material types. While we strive for high accuracy, these tools are provided &quot;as-is.&quot; Users should verify material specifications independently before completing high-value transactions.
              </p>
            </div>
          </section>

          <section id="privacy" className="terms-section">
            <h2 className="terms-section-heading">8. Privacy & Data Protection</h2>
            <p>
              Your privacy is important to us. Data collected through the platform is processed in accordance with our Privacy Policy and GDPR/CCPA requirements where applicable. We use your data to facilitate marketplace matching and improve platform efficiency.
            </p>
          </section>

          <section id="limitation" className="terms-section">
            <h2 className="terms-section-heading">9. Limitation of Liability</h2>
            <p>
              EcoLoop shall not be liable for indirect, incidental, or consequential damages arising from use of the platform. Our total liability is limited as set forth in the applicable agreement.
            </p>
          </section>

          <section id="termination" className="terms-section">
            <h2 className="terms-section-heading">10. Termination</h2>
            <p>
              We may suspend or terminate your account for breach of these terms. You may close your account at any time through your account settings.
            </p>
          </section>

          <section id="governing-law" className="terms-section">
            <h2 className="terms-section-heading">11. Governing Law</h2>
            <p>
              These terms are governed by the laws of the jurisdiction in which EcoLoop operates. Any disputes shall be resolved in the applicable courts.
            </p>
          </section>

          {!fromAccount && (
            <div className="terms-acceptance">
              <label className="terms-checkbox-wrap">
                <input type="checkbox" className="terms-checkbox" />
                <span className="terms-checkbox-label">I agree to the Terms & Conditions and Privacy Policy</span>
              </label>
              <Link to="/register" className="btn btn-primary terms-accept-btn">
                Sign Up & Accept
              </Link>
              <p className="terms-updated">Last updated: October 24, 2025</p>
            </div>
          )}
          {fromAccount && <p className="terms-updated">Last updated: October 24, 2025</p>}
        </main>
      </div>

      <footer className="terms-footer">
        <div className="terms-footer-main">
          <div className="terms-footer-brand">
            <Link to="/" className="terms-footer-logo">
              <img src={ecoLoopLogo} alt="EcoLoop" />
            </Link>
            <p className="terms-footer-tagline">
              Accelerating the transition to a circular economy through smart marketplace technology.
            </p>
          </div>
          <div className="terms-footer-col">
            <h4 className="terms-footer-heading">Quick links</h4>
            <Link to="/">Home</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/about">About Us</Link>
            <Link to="/contact">Contact</Link>
          </div>
          <div className="terms-footer-col">
            <h4 className="terms-footer-heading">Legal</h4>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms" className="terms-footer-legal-active">Terms & Conditions</Link>
            <Link to="/cookies">Cookie Policy</Link>
          </div>
          <div className="terms-footer-col">
            <h4 className="terms-footer-heading">Connect</h4>
            <div className="terms-footer-socials">
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">in</a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">𝕏</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">📷</a>
            </div>
          </div>
        </div>
        <div className="terms-footer-bottom">
          <p>© 2026 EcoLoop Inc. All rights reserved. Built for a sustainable future.</p>
        </div>
      </footer>
    </div>
  );
}
