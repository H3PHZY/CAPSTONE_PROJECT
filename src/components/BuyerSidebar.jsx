import { Link } from "react-router-dom";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";

const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
);
const IconBag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);
const IconOrder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
);
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

/**
 * Shared buyer nav + optional progress block (same markup as Buyer Dashboard).
 * @param {'dashboard'|'marketplace'|'orders'|'account'} active
 * @param {{ loading: boolean, tierNum: number, tierName: string, fillPct: number } | null} progress — null hides progress
 * @param {string} [className] — extra classes on aside (e.g. messages-sidebar)
 */
export default function BuyerSidebar({ active, progress, className = "" }) {
  const item = (id) => (active === id ? "buyer-nav-item buyer-nav-item-active" : "buyer-nav-item");
  return (
    <aside className={`buyer-sidebar ${className}`.trim()}>
      <Link to="/" state={SIDEBAR_LOGO_HOME_STATE} className="buyer-sidebar-logo">
        <img src={ecoLoopLogo} alt="Eco loop" />
      </Link>
      <nav className="buyer-sidebar-nav">
        <Link to="/buyer/dashboard" className={item("dashboard")}>
          <IconGrid /> <span>Dashboard</span>
        </Link>
        <Link to="/marketplace" className={item("marketplace")}>
          <IconBag /> <span>My Marketplace</span>
        </Link>
        <Link to="/buyer/orders" className={item("orders")}>
          <IconOrder /> <span>Orders</span>
        </Link>
        <Link to="/buyer/account" className={item("account")}>
          <IconUser /> <span>Account Settings</span>
        </Link>
      </nav>
      {progress != null && (
        <div className="buyer-progress">
          <div className="buyer-progress-label">PROGRESS LEVEL</div>
          <div className="buyer-progress-bar-wrap">
            <div className="buyer-progress-bar-inner">
              <span className="buyer-progress-tier">
                {progress.loading ? "—" : `Tier ${progress.tierNum}: ${progress.tierName}`}
              </span>
              <div
                className="buyer-progress-fill"
                style={{ width: progress.loading ? "0%" : `${progress.fillPct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
