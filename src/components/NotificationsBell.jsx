import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAuthUser } from "../utils/auth";

const STORAGE_KEY = "ecoloop_notifications";

const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

function getStoredNotifications() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeNotifications(list) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Bell icon button that toggles a notifications dropdown. Uses same UI across all pages.
 * @param {{ variant?: string, className?: string, showBadge?: boolean, messageCount?: number }} props
 */
export default function NotificationsBell({ variant = "seller-topbar", className = "", showBadge = false, messageCount = 0 }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(getStoredNotifications);
  const containerRef = useRef(null);

  useEffect(() => {
    setNotifications(getStoredNotifications());
  }, [open]);

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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const badgeCount = showBadge && messageCount > 0 ? messageCount : unreadCount;

  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    storeNotifications(updated);
  };

  const user = getAuthUser();
  const isBuyer = user?.userType === "buyer" || user?.role === "buyer";
  const messagesPath = isBuyer ? "/buyer/messages" : "/seller/messages";

  return (
    <div className={`notifications-bell-wrap ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`seller-topbar-icon-btn notifications-bell-btn ${variant}`}
        aria-label={badgeCount > 0 ? `${badgeCount} notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="notifications-bell-icon-wrap">
          <IconBell />
          {badgeCount > 0 && (
            <span className="notifications-bell-badge" aria-hidden="true">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="notifications-bell-dropdown" role="menu">
          <div className="notifications-bell-dropdown-header">
            <span className="notifications-bell-dropdown-title">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notifications-bell-mark-all" onClick={handleMarkAllRead}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="notifications-bell-dropdown-list">
            {notifications.length === 0 ? (
              <div className="notifications-bell-empty">No new notifications</div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className={`notifications-bell-item ${n.read ? "notifications-bell-item-read" : ""}`}
                  role="menuitem"
                >
                  <span className="notifications-bell-item-title">{n.title || "Notification"}</span>
                  {n.message && <span className="notifications-bell-item-message">{n.message}</span>}
                </div>
              ))
            )}
          </div>
          <div className="notifications-bell-dropdown-footer">
            <Link to={messagesPath} className="notifications-bell-link" onClick={() => setOpen(false)}>
              View messages
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
