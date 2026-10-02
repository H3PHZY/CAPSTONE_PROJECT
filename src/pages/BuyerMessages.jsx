import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import ecoLoopLogo from "../assets/brand/ecoloop-logo.png";
import { SIDEBAR_LOGO_HOME_STATE } from "../constants/navigation";
import AvatarMenu from "../components/AvatarMenu";
import { useToast } from "../contexts/ToastContext";
import { createConversation, addMessageToConversation, getConversationsForBuyer, getUnreadCount, markConversationAsRead } from "../utils/contactMessages";

const IconGrid9 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="5" rx="0.5"/><rect x="10" y="3" width="5" height="5" rx="0.5"/><rect x="17" y="3" width="4" height="5" rx="0.5"/><rect x="3" y="10" width="5" height="5" rx="0.5"/><rect x="10" y="10" width="5" height="5" rx="0.5"/><rect x="17" y="10" width="4" height="5" rx="0.5"/><rect x="3" y="17" width="5" height="4" rx="0.5"/><rect x="10" y="17" width="5" height="4" rx="0.5"/><rect x="17" y="17" width="4" height="4" rx="0.5"/></svg>
);
const IconOrder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);
const IconBag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);
const IconMessagePlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="12" y1="7" x2="12" y2="13"/></svg>
);
const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconSend = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);

function formatTime(iso) {
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

export default function BuyerMessages() {
  const showToast = useToast();
  const buyerName = typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Buyer") : "Buyer";
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState("");
  const searchInputRef = useRef(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSeller, setComposeSeller] = useState("");
  const [composeListingTitle, setComposeListingTitle] = useState("");
  const [composeMessage, setComposeMessage] = useState("");

  const loadConversations = () => {
    const list = getConversationsForBuyer(buyerName) || [];
    setConversations(list);
    if (!selectedId) {
      setSelectedId(list[0]?.id ?? null);
    }
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const convCards = useMemo(() => {
    const fromStorage = conversations.map((c) => {
      const lastMsg = Array.isArray(c.messages) && c.messages.length ? c.messages[c.messages.length - 1] : null;
      return {
        id: c.id,
        name: c.sellerName,
        last: lastMsg?.body || c.listingTitle || "—",
        time: lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : "",
        unread: getUnreadCount(c, "buyer"),
        listingTitle: c.listingTitle,
      };
    });
    const base = fromStorage;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => String(c.name || "").toLowerCase().includes(q) || String(c.last || "").toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const selectedConv = useMemo(() => {
    if (!selectedId) return null;
    return conversations.find((c) => String(c.id) === String(selectedId)) || null;
  }, [conversations, selectedId]);

  const threadMessages = useMemo(() => {
    if (!selectedConv) return [];
    const msgs = Array.isArray(selectedConv.messages) ? selectedConv.messages : [];
    return msgs;
  }, [selectedConv]);

  const handleSelect = (id) => {
    setSelectedId(id);
    setDraft("");
    markConversationAsRead(id, "buyer");
    loadConversations();
  };

  const handleSend = () => {
    if (!selectedConv) return;
    if (!draft.trim()) return;
    addMessageToConversation(selectedConv.id, "buyer", draft);
    setDraft("");
    loadConversations();
  };

  const handleOpenCompose = () => {
    setComposeSeller("");
    setComposeListingTitle("");
    setComposeMessage("");
    setComposeOpen(true);
  };

  const handleComposeSend = () => {
    const sellerName = composeSeller.trim();
    const listingTitle = composeListingTitle.trim() || "General inquiry";
    const body = composeMessage.trim();
    if (!sellerName || !body) {
      showToast("Please enter a seller name and a message.");
      return;
    }
    const conv = createConversation({
      listingId: `manual_${Date.now()}`,
      listingTitle,
      sellerName,
      buyerName,
    });
    addMessageToConversation(conv.id, "buyer", body);
    setComposeOpen(false);
    setSelectedId(conv.id);
    loadConversations();
    showToast("Message sent.");
  };

  return (
    <div className="messages-layout">
      <aside className="buyer-sidebar messages-sidebar">
        <Link to="/" state={SIDEBAR_LOGO_HOME_STATE} className="buyer-sidebar-logo">
          <img src={ecoLoopLogo} alt="Eco loop" />
        </Link>
        <nav className="buyer-sidebar-nav">
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
        </nav>
      </aside>

      <div className="messages-main">
        <header className="seller-topbar seller-topbar-gray seller-topbar-with-breadcrumb messages-topbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/buyer/dashboard">Dashboard</Link>
            <span className="breadcrumb-sep">&gt;</span>
            <span className="breadcrumb-current">Messages</span>
          </nav>
          <div className="seller-topbar-right">
            <div className="seller-topbar-user">
              <span className="seller-topbar-user-name">
                {typeof window !== "undefined" ? (localStorage.getItem("ecoloop_fullName") || "Buyer") : "Buyer"}
              </span>
            </div>
            <AvatarMenu accountPath="/buyer/account" variant="seller-topbar" />
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
                placeholder="Search conversations"
                className="messages-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <ul className="messages-conv-list">
              {convCards.map((c) => (
                <li
                  key={c.id}
                  className={`messages-conv-item ${String(selectedId) === String(c.id) ? "selected" : ""} ${c.unread ? "unread" : ""}`}
                  onClick={() => handleSelect(c.id)}
                >
                  <div className="messages-conv-avatar messages-conv-avatar-blue" aria-hidden="true">
                    {c.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="messages-conv-main">
                    <div className="messages-conv-top">
                      <span className="messages-conv-name">{c.name}</span>
                      <span className="messages-conv-time">{c.time}</span>
                    </div>
                    <div className="messages-conv-bottom">
                      <span className="messages-conv-last">{c.last}</span>
                      {c.unread > 0 && <span className="messages-conv-badge">{c.unread}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="messages-thread-pane">
            {selectedConv ? (
              <>
                <header className="messages-thread-header">
                  <div className="messages-thread-info">
                    <div className="messages-thread-avatar messages-conv-avatar-blue" aria-hidden="true">
                      {String(selectedConv.sellerName || "").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="messages-thread-name">{selectedConv.sellerName || "Seller"}</h2>
                      <p className="messages-thread-sub">{selectedConv.listingTitle ? `About: ${selectedConv.listingTitle}` : "Conversation"}</p>
                    </div>
                  </div>
                </header>

                <div className="messages-thread-body">
                  {threadMessages.map((m, idx) => (
                    <div key={idx} className={`messages-bubble-row ${m.from === "buyer" ? "from-me" : "from-them"}`}>
                      <div className={`messages-bubble ${m.from === "buyer" ? "messages-bubble-out" : "messages-bubble-in"}`}>
                        <p>{m.body}</p>
                        <span className="messages-bubble-meta">{formatTime(m.createdAt)}</span>
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
                <p>Select a seller on the left to view and reply to messages about your orders.</p>
              </div>
            )}
          </section>
        </main>
      </div>
      {composeOpen && (
        <div className="contact-seller-overlay" role="dialog" aria-modal="true" aria-labelledby="compose-title">
          <div className="contact-seller-modal">
            <h2 id="compose-title" className="contact-seller-title">New message</h2>
            <p className="contact-seller-subtitle">Send a message to a seller.</p>
            <input
              className="contact-seller-textarea"
              style={{ minHeight: "auto", height: "auto" }}
              placeholder="Seller name (e.g. GreenTech Manufacturing)"
              value={composeSeller}
              onChange={(e) => setComposeSeller(e.target.value)}
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

