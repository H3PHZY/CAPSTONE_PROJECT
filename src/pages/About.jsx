import { useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import FooterSection from "../components/FooterSection";
import ContactSection from "../components/ContactSection";
import aboutHeroImage from "../assets/about-hero.png";

const IconLeaf = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);
const IconRecycle = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16l-4-4m0 0l4-4m-4 4h10a4 4 0 014 4v1M17 8l4 4m0 0l-4 4m4-4H7a4 4 0 01-4-4V7" />
  </svg>
);
const IconHandshake = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const IconDoc = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);
const IconChart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconSearch = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const MISSION_CARDS = [
  {
    icon: IconLeaf,
    title: "Reduce industrial waste",
    description: "Lowering the volume of factory generated materials sent to landfills through strategic repurposing.",
  },
  {
    icon: IconRecycle,
    title: "Promote circular economy",
    description: "Creating a closed-loop system where one company's waste becomes another's valuable raw material.",
  },
  {
    icon: IconHandshake,
    title: "Enable sustainable trade",
    description: "Providing a secure and efficient platform for ethical businesses to exchange materials and grow.",
  },
];

const HOW_IT_WORKS = [
  { icon: IconDoc, title: "Producers list materials", description: "Easy upload of waste profiles and quantities" },
  { icon: IconChart, title: "AI analyzes waste", description: "Smart categorization for optimal matching" },
  { icon: IconSearch, title: "Buyers discover matches", description: "Real-time alerts for needed raw materials" },
  { icon: IconShield, title: "Secure transactions", description: "Trusted checkout and logistics support" },
];

export default function About() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Navbar />
      <main className="about-page">
        {/* Hero */}
        <section className="about-hero" aria-label="About EcoLoop">
          <div className="about-hero-image-wrap">
            <img
              src={aboutHeroImage}
              alt="Industrial waste handling: excavator processing mixed recyclables and materials in a facility"
              className="about-hero-image"
            />
            <div className="about-hero-overlay" aria-hidden="true" />
          </div>
          <div className="about-hero-content">
            <h1 className="about-hero-title">About EcoLoop</h1>
            <p className="about-hero-tagline">EcoLoop connects SME factories across Africa with verified buyers who turn your metal scraps, plastic remnants, and wood offcuts into valuable resources while reducing environmental impact.</p>
          </div>
        </section>
        {/* 1. Who We Are */}
        <section className="about-section about-who">
          <h2 className="about-heading about-heading-green">Who We Are</h2>
          <p className="about-text about-text-center">
            EcoLoop is a digital marketplace that connects industrial waste producers with recyclers and artisans. The platform uses <span className="about-text-green">AI-powered recognition</span> and smart matching to promote sustainability and reduce environmental impact. We bridge the gap between waste and resources, fostering a cleaner future for global industry.
          </p>
        </section>

        {/* 2. Our Mission */}
        <section className="about-section about-mission">
          <h2 className="about-heading about-heading-white">Our Mission</h2>
          <div className="about-mission-cards">
            {MISSION_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="about-mission-card">
                  <div className="about-mission-icon-wrap">
                    <Icon />
                  </div>
                  <h3 className="about-mission-title">{card.title}</h3>
                  <p className="about-mission-desc">{card.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. How It Works */}
        <section className="about-section about-how">
          <h2 className="about-heading about-heading-green">How It Works</h2>
          <div className="about-how-steps">
            {HOW_IT_WORKS.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <div key={i} className="about-how-step">
                  <div className="about-how-icon-wrap">
                    <StepIcon />
                  </div>
                  <h3 className="about-how-title">{step.title}</h3>
                  <p className="about-how-desc">{step.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Our Vision */}
        <section className="about-section about-vision">
          <h2 className="about-heading about-heading-green">Our Vision</h2>
          <p className="about-text about-text-center">
            To become a leading sustainable waste marketplace powered
            <br />
            by intelligent technology.
          </p>
        </section>

        {/* 5. Call to Action */}
        <section className="about-section about-cta-wrap">
          <div className="about-cta-box">
            <h2 className="about-cta-heading">Ready to make an impact?</h2>
            <p className="about-cta-sub">Join EcoLoop and be part of the circular economy revolution today.</p>
            <Link to="/register" className="about-cta-btn">Join EcoLoop</Link>
          </div>
        </section>

        {/* 6. Contact – same as landing page */}
        <ContactSection />
      </main>
      <FooterSection />
    </>
  );
}
