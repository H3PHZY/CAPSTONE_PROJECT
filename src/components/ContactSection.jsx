import { useState } from "react";
import { Link } from "react-router-dom";
import { getAuthToken } from "../utils/auth";
import { useToast } from "../contexts/ToastContext";

const CONTACT_EMAIL = "hello@ecoloopas.com";

const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IconFacebook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);
const IconLinkedIn = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);
const IconYouTube = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

function ContactSection() {
  const isLoggedIn = Boolean(getAuthToken());
  const showToast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [looking, setLooking] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleMarketplaceClick = (e) => {
    if (isLoggedIn) return;
    e.preventDefault();
    showToast("Please Sign Up or Sign In to view our Marketplace");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(
      `Contact from EcoLoop: ${looking.trim() || "General enquiry"}`
    );
    const body = encodeURIComponent(
      `Name: ${name.trim() || "—"}\nEmail: ${email.trim() || "—"}\nLooking for: ${looking.trim() || "—"}\n\nMessage:\n${message.trim() || "—"}`
    );
    const mailto = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    window.location.href = mailto;
    setSubmitted(true);
    showToast("Message submitted successfully! We'll get back to you soon.");
    setName("");
    setEmail("");
    setLooking("");
    setMessage("");
  };

  return (
    <section id="contact" className="section contact-section" aria-label="Contact">
      <div className="contact-section-top">
        {isLoggedIn ? (
          <Link to="/marketplace" className="contact-marketplace-btn">
            <IconGrid />
            Go to Marketplace
          </Link>
        ) : (
          <button
            type="button"
            className="contact-marketplace-btn contact-marketplace-btn-inactive"
            onClick={handleMarketplaceClick}
            aria-label="Go to Marketplace – sign in or sign up to access"
          >
            <IconGrid />
            Go to Marketplace
          </button>
        )}
      </div>
      <div className="contact-container">
        <div className="contact-inner">
          <div className="contact-form-wrap">
            <h2 className="contact-form-title">Say Hi!</h2>
            <p className="contact-form-sub">We would like to hear from you.</p>
            {submitted && (
              <p className="contact-form-success" role="status">
                Thank you! Your message has been submitted successfully. We&apos;ll get back to you soon.
              </p>
            )}
            <form className="contact-form" onSubmit={handleSubmit}>
              <label className="contact-label">
                My name is
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="contact-label">
                My Email is
                <input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="contact-label">
                I&apos;m looking for
                <input
                  type="text"
                  name="looking"
                  placeholder="What you love"
                  value={looking}
                  onChange={(e) => setLooking(e.target.value)}
                />
              </label>
              <label className="contact-label">
                Your message
                <textarea
                  name="message"
                  rows={4}
                  placeholder="I want to say that...."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <button type="submit" className="contact-send-btn">Send Message</button>
            </form>
          </div>
          <div className="contact-info-wrap">
            <h2 className="contact-info-title">Contact Information</h2>
            <p className="contact-info-desc">
              Fill up the form and our Team will get back to you within 24 hours.
            </p>
            <div className="contact-details">
              <p className="contact-detail">Lagos, Nigeria</p>
              <p className="contact-detail">(+234) 772 100 200</p>
              <p className="contact-detail">hello@ecoloopas.com</p>
              <p className="contact-detail">Ecoloop waste management</p>
            </div>
            <div className="contact-socials">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IconFacebook /></a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><IconLinkedIn /></a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><IconYouTube /></a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
