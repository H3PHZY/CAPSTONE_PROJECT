import { Link } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";

function FooterSection() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="footer-logo" aria-label="EcoLoop Home">
            <img src={ecoLoopLogo} alt="EcoLoop" />
          </Link>
          <p className="footer-desc">
            Connecting African factories with verified buyers to turn industrial waste into revenue and a cleaner planet.
          </p>
          <div className="footer-socials">
            <a href="#facebook" aria-label="Facebook">f</a>
            <a href="#twitter" aria-label="Twitter">𝕏</a>
            <a href="#instagram" aria-label="Instagram">📷</a>
            <a href="#linkedin" aria-label="LinkedIn">in</a>
          </div>
        </div>
        <div className="footer-links-col">
          <h4>Company</h4>
          <Link to="/about">About Us</Link>
          <Link to="/team">Team</Link>
          <Link to="/careers">Careers</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/work">Our Work</Link>
        </div>
        <div className="footer-links-col">
          <h4>Support</h4>
          <Link to="/#contact">Customer Support</Link>
          <Link to="/#contact">Help Center</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/#contact">Contact Us</Link>
        </div>
        <div className="footer-links-col">
          <h4>Contact Us</h4>
          <p>Lagos, Nigeria</p>
          <p>(+234) 772 100 200</p>
          <p>hello@ecoloopas.com</p>
          <p>Ecoloop waste management</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>Copyright © 2026 EcoLoop. All Rights Reserved.</span>
        <div className="footer-legal">
          <Link to="/privacy">Privacy Policy</Link>
          <span>|</span>
          <Link to="/terms">Terms and Conditions</Link>
          <span>|</span>
          <Link to="/cookies">Cookie Policy</Link>
        </div>
      </div>
    </footer>
  );
}

export default FooterSection;
