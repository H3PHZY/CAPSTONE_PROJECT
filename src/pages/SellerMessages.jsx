import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import AvatarMenu from "../components/AvatarMenu";
import { getListings } from "../services/listingsApi";
import { getProducerLevelFromListings } from "../utils/producerLevel";
import { addMessageToConversation, createConversation, getConversationsForProducer, getUnreadCount, markConversationAsRead } from "../utils/contactMessages";
import { useToast } from "../contexts/ToastContext";
import GlobalSearchBar from "../components/GlobalSearchBar";

const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
);
const IconBag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);
const IconMessagePlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="12" y1="7" x2="12" y2="13"/></svg>
);
const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);
const IconChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
);
const IconOrder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);
const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);
const IconVideo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
);
const IconEllipsisV = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
);
const IconCube = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);
const IconMapPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);
const IconSend = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconStar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
);
const IconGrid9 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="5" rx="0.5"/><rect x="10" y="3" width="5" height="5" rx="0.5"/><rect x="17" y="3" width="4" height="5" rx="0.5"/><rect x="3" y="10" width="5" height="5" rx="0.5"/><rect x="10" y="10" width="5" height="5" rx="0.5"/><rect x="17" y="10" width="4" height="5" rx="0.5"/><rect x="3" y="17" width="5" height="4" rx="0.5"/><rect x="10" y="17" width="5" height="4" rx="0.5"/><rect x="17" y="17" width="4" height="4" rx="0.5"/></svg>
);
const IconList = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
);
const IconArrows = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M17 7H7v10"/></svg>
);
const IconCheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

function Stars({ value }) {
  return (
    <span className="messages-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? "filled" : ""}><IconStar /></span>
      ))}
    </span>
  );
}

const AVATAR_LABELS = { gt: "GT", mm: "MM", ep: "EP", cs: "CS" };
const AVATAR_COLORS = { gt: "green", mm: "teal", ep: "blue", cs: "purple" };

function getFullNameAndInitials() {
  const fullName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "User") : "User";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (fullName.trim()[0] || "U").toUpperCase();
  return { fullName, initials };
}

const DEFAULT_LEVEL = { tierLabel: "Tier 1: Bronze", progressPercent: 0 };

function formatMessageTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (diff < 86400000) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function SellerMessages() {
  const { pathname } = useLocation();
  const isProducer = true;
  const { fullName, initials } = getFullNameAndInitials();
  const showToast = useToast();
  const [producerLevel, setProducerLevel] = useState(DEFAULT_LEVEL);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [draft, setDraft] = useState("");
  const searchInputRef = useRef(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeBuyer, setComposeBuyer] = useState("");
  const [composeListingTitle, setComposeListingTitle] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const producerConversations = useMemo(() => {
    if (!isProducer || !fullName) return [];
    return getConversationsForProducer(fullName);
  }, [isProducer, fullName, refreshKey]);

  const location = useLocation();
  useEffect(() => {
    const openId = location.state?.openConversationId;
    if (openId && producerConversations.some((c) => c.id === openId)) {
      setSelectedConvId(openId);
    } else if (!selectedConvId && producerConversations.length) {
      setSelectedConvId(producerConversations[0].id);
    }
  }, [producerConversations, selectedConvId, location.state?.openConversationId]);

  const selectedConv = useMemo(() => {
    if (!selectedConvId) return null;
    return producerConversations.find((c) => c.id === selectedConvId) || null;
  }, [producerConversations, selectedConvId]);

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" && window.localStorage?.getItem("ecoloop_token");
    if (!isProducer || !token) return;
    getListings()
      .then((res) => {
        if (cancelled) return;
        const list = res.listings && Array.isArray(res.listings) ? res.listings : [];
        setProducerLevel(getProducerLevelFromListings(list));
      })
      .catch(() => { if (!cancelled) setProducerLevel(DEFAULT_LEVEL); });
    return () => { cancelled = true; };
  }, [isProducer]);

  const conversations = useMemo(() => {
    // Normalize stored conversations into the UI shape used below.
    const list = producerConversations.map((c) => {
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      return {
        id: c.id,
        name: c.buyerName || c.name || "Buyer",
        last: last?.body || c.listingTitle || c.last || "—",
        lastMessageTime: last?.createdAt,
        time: c.time || "",
        unread: getUnreadCount(c, "seller"),
        online: c.online,
        rating: c.rating,
        location: c.location,
        listingTitle: c.listingTitle,
        listingId: c.listingId,
        messages: msgs.map((m) => ({ from: m.from === "seller" ? "me" : "them", text: m.body, time: m.createdAt })),
      };
    });
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => String(c.name).toLowerCase().includes(q) || String(c.last).toLowerCase().includes(q) || String(c.listingTitle || "").toLowerCase().includes(q));
  }, [producerConversations, searchQuery]);

  const handleSelectConversation = (id) => {
    setSelectedConvId(id);
    markConversationAsRead(id, "seller");
    setRefreshKey((k) => k + 1);
  };

  const handleSend = () => {
    if (!selectedConv || !draft.trim()) return;
    addMessageToConversation(selectedConv.id, "seller", draft);
    setDraft("");
    showToast("Message sent.");
  };

  const handleOpenCompose = () => {
    setComposeBuyer("");
    setComposeListingTitle("");
    setComposeMessage("");
    setComposeOpen(true);
  };

  const handleComposeSend = () => {
    const buyerName = composeBuyer.trim();
    const listingTitle = composeListingTitle.trim() || "General inquiry";
    const body = composeMessage.trim();
    if (!buyerName || !body) {
      showToast("Please enter a buyer name and a message.");
      return;
    }
    const conv = createConversation({
      listingId: `manual_${Date.now()}`,
      listingTitle,
      sellerName: fullName,
      buyerName,
    });
    addMessageToConversation(conv.id, "seller", body);
    setComposeOpen(false);
    setSelectedConvId(conv.id);
    showToast("Message sent.");
  };

  return (
    <div className={isProducer ? "messages-layout messages-layout-producer" : "messages-layout"}>
      <aside className={isProducer ? "producer-sidebar messages-sidebar" : "buyer-sidebar messages-sidebar"}>
        <Link to="/" state={SIDEBAR_LOGO_HOME_STATE} className={isProducer ? "producer-sidebar-logo" : "buyer-sidebar-logo"}>
          <img src={ecoLoopLogo} alt="Eco loop" />
        </Link>
        <nav className={isProducer ? "producer-sidebar-nav" : "buyer-sidebar-nav"}>
          {isProducer ? (
            <>
              <Link to="/seller/dashboard" className="producer-nav-item">
                <IconGrid /> <span>Dashboard</span>
              </Link>
              <Link to="/seller/inventory" className="producer-nav-item">
                <IconBox /> <span>Inventory</span>
              </Link>
              <Link to="/seller/listings" className="producer-nav-item">
                <IconList /> <span>Listings</span>
              </Link>
              <Link to="/seller/transactions" className="producer-nav-item">
                <IconArrows /> <span>Transactions</span>
              </Link>
              <Link to="/seller/messages" className="producer-nav-item producer-nav-item-active">
                <IconCheckCircle /> <span>Messages</span>
              </Link>
              <Link to="/seller/account" className="producer-nav-item">
                <IconGear /> <span>Account Settings</span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/buyer/dashboard" className="buyer-nav-item">
                <IconGrid9 /> <span>Dashboard</span>
              </Link>
              <Link to="/marketplace" className="buyer-nav-item">
                <IconBag /> <span>My Marketplace</span>
              </Link>
              <Link to="/buyer/orders" className="buyer-nav-item">
                <IconOrder /> <span>Orders</span>
              </Link>
              <Link to="/buyer/account" className="buyer-nav-item">
                <IconUser /> <span>Account Settings</span>
              </Link>
            </>
          )}
        </nav>
        {isProducer && (
          <div className="producer-level">
            <div className="producer-level-label">PRODUCER LEVEL</div>
            <div className="producer-level-tier">{producerLevel.tierLabel}</div>
            <div className="producer-level-bar-wrap">
              <div
                className="producer-level-bar"
                style={{ width: `${producerLevel.progressPercent ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </aside>

      <div className="messages-main">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb messages-topbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/seller/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <span className="breadcrumb-current">Messages</span>
          </nav>
          <div className="seller-topbar-right">
            <GlobalSearchBar />
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">{fullName}</span>
            </div>
            <AvatarMenu accountPath="/seller/account" variant="seller-topbar" />
          </div>
        </header>

        <main className="messages-content">
          <section className="messages-list-pane">
            <div className="messages-list-header">
              <h1 className="messages-title">Messages</h1>
              <button type="button" className="messages-new-btn" onClick={handleOpenCompose} aria-label="New message">
                <IconMessagePlus />
              </button>
            </div>
            <div className="messages-search-wrap">
              <IconSearch />
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search buyers, materials, or listing ID"
                className="messages-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <ul className="messages-conv-list">
              {conversations.map((c) => {
                const isSelected = selectedConv && selectedConv.id === c.id;
                const label = AVATAR_LABELS[c.id] || c.name[0] || "B";
                const color = AVATAR_COLORS[c.id] || "gray";
                const timeLabel = c.lastMessageTime ? formatMessageTime(c.lastMessageTime) : c.time;
                return (
                  <li
                    key={c.id}
                    className={`messages-conv-item ${isSelected ? "selected" : ""} ${c.unread ? "unread" : ""}`}
                    onClick={() => handleSelectConversation(c.id)}
                  >
                    <div className={`messages-conv-avatar messages-conv-avatar-${color}`} aria-hidden="true">
                      {label}
                      {c.online && <span className="messages-conv-status-dot" />}
                    </div>
                    <div className="messages-conv-main">
                      <div className="messages-conv-top">
                        <span className="messages-conv-name">{c.name}</span>
                        <span className="messages-conv-time">{timeLabel}</span>
                      </div>
                      <div className="messages-conv-bottom">
                        <span className="messages-conv-last">{c.last}</span>
                        {c.unread > 0 && <span className="messages-conv-badge">{c.unread}</span>}
                        {c.rating && (
                          <span className="messages-conv-rating">
                            <Stars value={Math.round(c.rating)} /> <span>{c.rating.toFixed(1)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="messages-thread-pane">
            {selectedConv ? (
              <>
                <header className="messages-thread-header">
                  <div className="messages-thread-info">
                    <div className={`messages-thread-avatar messages-conv-avatar-${AVATAR_COLORS[selectedConv.id] || "gray"}`} aria-hidden="true">
                      {AVATAR_LABELS[selectedConv.id] || selectedConv.name[0] || "B"}
                    </div>
                    <div>
                      <h2 className="messages-thread-name">{selectedConv.name}</h2>
                      <p className="messages-thread-sub">{selectedConv.location || "Ikeja, Lagos - 3.5 km"}</p>
                    </div>
                  </div>
                  <div className="messages-thread-actions">
                    <button type="button" className="messages-thread-icon-btn" aria-label="Call">
                      <IconPhone />
                    </button>
                    <button type="button" className="messages-thread-icon-btn" aria-label="Video call">
                      <IconVideo />
                    </button>
                    <button type="button" className="messages-thread-icon-btn" aria-label="More options">
                      <IconEllipsisV />
                    </button>
                  </div>
                </header>

                <div className="messages-thread-body">
                  {(selectedConv.messages || []).map((msg, idx) => (
                    <div
                      key={idx}
                      className={`messages-bubble-row ${msg.from === "me" ? "from-me" : "from-them"}`}
                    >
                      <div className={`messages-bubble ${msg.from === "me" ? "messages-bubble-out" : "messages-bubble-in"}`}>
                        <p>{msg.text}</p>
                        <span className="messages-bubble-meta">
                          {formatMessageTime(msg.time)} {msg.from === "me" && <IconCheck />}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <footer className="messages-thread-footer">
                  <input
                    type="text"
                    className="messages-thread-input"
                    placeholder="Write a message..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
                  />
                  <button type="button" className="messages-thread-send-btn" aria-label="Send message" onClick={handleSend} disabled={!draft.trim()}>
                    <IconSend />
                  </button>
                </footer>
              </>
            ) : (
              <div className="messages-thread-empty">
                <h2>No conversation selected</h2>
                <p>Select a buyer on the left to view and reply to messages about your listings.</p>
              </div>
            )}
          </section>
        </main>
      </div>
      {composeOpen && (
        <div className="contact-seller-overlay" role="dialog" aria-modal="true" aria-labelledby="compose-title">
          <div className="contact-seller-modal">
            <h2 id="compose-title" className="contact-seller-title">New message</h2>
            <p className="contact-seller-subtitle">Send a message to a buyer.</p>
            <input
              className="contact-seller-textarea"
              style={{ minHeight: "auto", height: "auto" }}
              placeholder="Buyer name (e.g. GreenTech Manufacturing)"
              value={composeBuyer}
              onChange={(e) => setComposeBuyer(e.target.value)}
            />
            <input
              className="contact-seller-textarea"
              style={{ minHeight: "auto", height: "auto" }}
              placeholder="Listing / topic (optional)"
              value={composeListingTitle}
              onChange={(e) => setComposeListingTitle(e.target.value)}
            />
            <textarea
              className="contact-seller-textarea"
              placeholder="Write your message..."
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
            />
            <div className="contact-seller-actions">
              <button type="button" className="contact-seller-close" onClick={() => setComposeOpen(false)}>Cancel</button>
              <button type="button" className="contact-seller-send" onClick={handleComposeSend}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

