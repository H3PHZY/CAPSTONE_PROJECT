import { useState } from "react";
import { useNavigate } from "react-router-dom";

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

export default function GlobalSearchBar() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const q = (value || "").trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate("/search");
    }
  };

  return (
    <form className="seller-topbar-search" role="search" onSubmit={handleSubmit}>
      <IconSearch />
      <input
        type="search"
        className="seller-topbar-search-input"
        placeholder="Search across app..."
        aria-label="Search across app"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit(e);
        }}
      />
    </form>
  );
}
