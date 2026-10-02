import { Link } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { getAuthToken, getAuthUser } from "../utils/auth";
import { useToast } from "../contexts/ToastContext";

function Navbar() {
  const isLoggedIn = Boolean(getAuthToken());
  const user = getAuthUser();
  const isBuyer = (user?.userType ?? user?.role) === "buyer";
  const dashboardHref = isBuyer ? "/buyer/dashboard" : "/seller/dashboard";
  const showToast = useToast();

  const handleMarketplaceClick = (e) => {
    if (isLoggedIn) return;
    e.preventDefault();
    showToast("Please Sign Up or Sign In to view our Marketplace");
  };

  return (
    <header className="navbar">
      <Link to="/" className="navbar-logo">
        <img src={ecoLoopLogo} alt="EcoLoop" />
      </Link>
      <nav className="navbar-links">
        <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</Link>
        <Link to="/about">About</Link>
        {isLoggedIn ? (
          <Link to="/marketplace">Marketplace</Link>
        ) : (
          <span
            className="navbar-link navbar-link-inactive"
            role="button"
            tabIndex={0}
            onClick={handleMarketplaceClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleMarketplaceClick(e); } }}
            aria-label="Marketplace – sign up or sign in to access"
          >
            Marketplace
          </span>
        )}
      </nav>
      <div className="navbar-actions">
        {isLoggedIn ? (
          <Link to={dashboardHref} className="btn btn-primary">Go to dashboard</Link>
        ) : (
          <>
            <Link to="/login" className="btn btn-outline">Sign in</Link>
            <Link to="/register" className="btn btn-primary">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
