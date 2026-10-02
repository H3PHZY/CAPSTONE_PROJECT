import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import LandingPageCard1 from "../components/LandingPageCard1";
import ChallengeSection from "../components/ChallengeSection";
import HowItWorksSection from "../components/HowItWorksSection";
import ServicesSection from "../components/ServicesSection";
import ContactSection from "../components/ContactSection";
import FooterSection from "../components/FooterSection";
import { getAuthToken, getAuthUser } from "../utils/auth";

function LandingPage() {
  const location = useLocation();
  const token = getAuthToken();
  const user = getAuthUser();
  const isBuyer = (user?.userType ?? user?.role) === "buyer";
  const isContactHash = location.hash === "#contact" || location.hash === "contact";
  const fromSidebarLogo = location.state?.fromSidebarLogo === true;

  useEffect(() => {
    if (isContactHash) {
      const el = document.getElementById("contact");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo(0, 0);
    }
  }, [isContactHash]);

  if (token && user && !isContactHash && !fromSidebarLogo) {
    return <Navigate to={isBuyer ? "/buyer/dashboard" : "/seller/dashboard"} replace />;
  }

  return (
    <>
      <Navbar />
      <LandingPageCard1 />
      <ChallengeSection />
      <HowItWorksSection />
      <ServicesSection />
      <ContactSection />
      <FooterSection />
    </>
  );
}

export default LandingPage;
