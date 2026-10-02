import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import cardImg from "../assets/img2.svg";
import { getTransactions } from "../services/transactionsApi";

const HERO_STATS_INITIAL = {
  tonsRecycled: 0,
  revenueNaira: 0,
  co2SavedTons: 0,
};

const CO2_KG_PER_TON = 500;

function formatRevenueNaira(n) {
  if (n >= 1e6) return "₦" + (n / 1e6).toFixed(0) + "M";
  if (n >= 1e3) return "₦" + (n / 1e3).toFixed(0) + "K";
  return "₦" + n.toLocaleString();
}

function quantityToTons(qty) {
  if (qty == null || qty === "") return 0;
  if (typeof qty === "number" && Number.isFinite(qty)) {
    // In our transaction normalization, quantity is typically in kg.
    return qty / 1000;
  }
  if (typeof qty !== "string") return 0;
  const s = qty.trim().toLowerCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  if (s.includes("ton")) return num;
  if (s.includes("kg")) return num / 1000;
  return num;
}

function parseQuantityToKg(qty) {
  if (qty == null || qty === "") return 0;
  if (typeof qty === "number" && Number.isFinite(qty)) return qty;
  const s = String(qty).toLowerCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  if (s.includes("ton")) return num * 1000;
  if (s.includes("kg")) return num;
  return num;
}

function computeTransactionRevenueNaira(t) {
  const explicit = Number(t?.totalPrice ?? t?.totalAmount ?? t?.amount ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const qtyKg = parseQuantityToKg(t?.quantity);
  const unitPrice = Number(t?.price ?? t?.listing?.price ?? 0);
  if (qtyKg > 0 && unitPrice > 0) return unitPrice * qtyKg;
  return 0;
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LandingPageCard1() {
  const [stats, setStats] = useState(HERO_STATS_INITIAL);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        setStatsLoading(true);

        const { transactions: allTxs } = await getTransactions();
        const completed = (Array.isArray(allTxs) ? allTxs : []).filter(
          (t) => String(t?.status ?? "").toUpperCase() === "COMPLETED"
        );

        const tonsRecycled = completed.reduce((sum, t) => sum + quantityToTons(t?.quantity), 0);
        const revenueNaira = completed.reduce((sum, t) => sum + computeTransactionRevenueNaira(t), 0);
        const co2SavedKg = tonsRecycled * CO2_KG_PER_TON;
        const co2SavedTons = co2SavedKg / 1000;

        if (cancelled) return;
        setStats({
          tonsRecycled: Math.round(tonsRecycled),
          revenueNaira: Math.round(revenueNaira),
          co2SavedTons: Math.round(co2SavedTons),
        });
      } catch (_) {
        if (!cancelled) setStats(HERO_STATS_INITIAL);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="hero">
      <img src={cardImg} alt="" className="hero-bg" aria-hidden="true" />
      <div className="hero-overlay" aria-hidden="true" />
      <div className="hero-content">
        <span className="hero-badge">Transforming Industrial Waste Management</span>
        <h1 className="hero-title">
          Turn Industrial Waste Into Revenue<br />
          <span className="hero-title-brand">EcoLoop</span>
        </h1>
        <p className="hero-desc">
          EcoLoop connects SME factories across Africa with verified buyers who turn
          your metal scraps, plastic remnants, and wood offcuts into valuable
          resources while reducing environmental impact.
        </p>
        <div className="hero-cta">
          <Link to="/register" className="btn btn-primary">Get Started</Link>
          <Link to="/register" className="btn btn-outline-light">Sign up</Link>
        </div>
        <div className="hero-stats">
          <button
            type="button"
            className="hero-stat hero-stat-btn"
            onClick={() => scrollToSection("about")}
            aria-label="Tons recycled – scroll to About"
          >
            <strong>{statsLoading ? "—" : stats.tonsRecycled.toLocaleString() + "+"}</strong>
            <span>Tons Recycled</span>
          </button>
          <button
            type="button"
            className="hero-stat hero-stat-btn"
            onClick={() => scrollToSection("services")}
            aria-label="Revenue generated – scroll to Services"
          >
            <strong>{statsLoading ? "—" : formatRevenueNaira(stats.revenueNaira)}</strong>
            <span>Revenue Generated</span>
          </button>
          <button
            type="button"
            className="hero-stat hero-stat-btn"
            onClick={() => scrollToSection("about")}
            aria-label="CO2 saved – scroll to About"
          >
            <strong>{statsLoading ? "—" : stats.co2SavedTons.toLocaleString()}</strong>
            <span>Tons CO<sub>2</sub> Saved</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default LandingPageCard1;
