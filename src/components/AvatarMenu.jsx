import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import { clearAuthSession } from "../utils/auth";

const IconLogOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/**
 * Avatar with hover dropdown: link to Profile (Account settings) and Log out.
 * @param {{ accountPath: string, variant?: string, className?: string }} props
 */
export default function AvatarMenu({ accountPath, variant = "seller-topbar", className = "" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const path = accountPath || "/seller/account";

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    return () => clearCloseTimeout();
  }, []);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  const handleLogout = (e) => {
    e.preventDefault();
    clearAuthSession();
    setOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <div
      className={`avatar-menu ${className}`.trim()}
      ref={containerRef}
      onMouseEnter={() => { clearCloseTimeout(); setOpen(true); }}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="avatar-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        <Avatar variant={variant} />
      </button>
      {open && (
        <div
          className="avatar-menu-dropdown"
          role="menu"
          onMouseEnter={clearCloseTimeout}
          onMouseLeave={handleMouseLeave}
        >
          <Link
            to={path}
            className="avatar-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <IconUser />
            <span>Profile &amp; Account settings</span>
          </Link>
          <button
            type="button"
            className="avatar-menu-item avatar-menu-item-logout"
            role="menuitem"
            onClick={handleLogout}
          >
            <IconLogOut />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
