"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCarbonImpact,
  type CarbonImpactSummary,
} from "@/lib/transactions";

const PILOT_GOAL_TONNES = 25;

export function ImpactPage() {
  const { user, ready } = useAuth();
  const [data, setData] = useState<CarbonImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    setLoading(true);
    void fetchCarbonImpact(user.id)
      .then((summary) => {
        if (!alive) return;
        setData(summary);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load impact");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [ready, user]);

  if (loading) {
    return (
      <div className="page-shell page-shell--wide">
        <div className="page-sub">Loading your carbon impact…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-shell page-shell--wide">
        <div className="empty-state">
          <div className="empty-title">{error || "No impact data yet"}</div>
        </div>
      </div>
    );
  }

  const tonnes = data.totalWeightKg / 1000;
  const goalPct = Math.min(
    100,
    Math.round((tonnes / PILOT_GOAL_TONNES) * 100)
  );
  const chart = data.byMonth.length
    ? data.byMonth
    : ([["—", 0, 500]] as [string, number, number][]);
  const cmax = Math.max(500, ...chart.map(([, , target]) => target));
  const streams = data.byMaterial.length
    ? data.byMaterial
    : ([["No completed exchanges yet", 0]] as [string, number][]);
  const smax = Math.max(100, ...streams.map(([, kg]) => kg));
  const trees = Math.round(data.totalCo2eKg / 23.2);
  const petrol = Math.round(data.totalCo2eKg / 2.35);
  const flights = Math.max(0, Math.round(data.totalCo2eKg / 400));

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Carbon impact</h1>
          <div className="page-sub">
            LCA-based estimates from your completed EcoLoop exchanges
          </div>
        </div>
      </div>

      <div className="impact-kpis">
        <div className="impact-kpi impact-kpi--dark">
          <div className="impact-kpi-label">TOTAL CO₂ DIVERTED</div>
          <div className="impact-kpi-row">
            <div className="impact-kpi-v">{data.totalCo2eKg.toLocaleString()}</div>
            <div className="impact-kpi-unit">kg CO₂e</div>
          </div>
          <div className="impact-kpi-delta">From your completed exchanges</div>
        </div>
        <div className="impact-kpi">
          <div className="impact-kpi-label impact-kpi-label--light">
            COMPLETED TRANSACTIONS
          </div>
          <div className="impact-kpi-row">
            <div className="impact-kpi-v impact-kpi-v--dark">{data.completedCount}</div>
            <div className="impact-kpi-unit impact-kpi-unit--muted">exchanges</div>
          </div>
          <div className="impact-kpi-foot">Marked completed in Messages</div>
        </div>
        <div className="impact-kpi">
          <div className="impact-kpi-label impact-kpi-label--light">
            LANDFILL WASTE SAVED
          </div>
          <div className="impact-kpi-row">
            <div className="impact-kpi-v impact-kpi-v--dark">
              {tonnes.toFixed(1)}
            </div>
            <div className="impact-kpi-unit impact-kpi-unit--muted">tonnes</div>
          </div>
          <div className="impact-kpi-foot">
            {data.completedCount
              ? `Avg ${Math.round(data.totalWeightKg / data.completedCount)} kg per exchange`
              : "Complete an exchange to start tracking"}
          </div>
        </div>
      </div>

      <div className="impact-grid">
        <div className="panel panel--pad">
          <div className="chart-head">
            <div>
              <div className="panel-label">MONTHLY CO₂e DIVERTED</div>
              <div className="panel-meta">kilograms, by month</div>
            </div>
            <div className="chart-legend">
              <div className="chart-legend-item">
                <span className="chart-swatch chart-swatch--achieved" />
                Achieved
              </div>
              <div className="chart-legend-item">
                <span className="chart-swatch chart-swatch--target" />
                Target
              </div>
            </div>
          </div>
          <div className="chart-bars">
            {chart.map(([month, val, target]) => (
              <div key={`${month}-${val}`} className="chart-col">
                <div className="chart-col-track">
                  <div
                    className="chart-target"
                    style={{ height: `${Math.round((target / cmax) * 100)}%` }}
                  >
                    <div className="chart-val">{val.toLocaleString()}</div>
                    <div
                      className="chart-achieved"
                      style={{
                        height: `${target ? Math.round((val / target) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="chart-month">{month}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="impact-side">
          <div className="panel panel--pad">
            <div className="panel-label">PILOT GOAL PROGRESS</div>
            <div className="goal-row">
              <div className="goal-pct">{goalPct}%</div>
              <div className="goal-meta">
                {tonnes.toFixed(1)}t / {PILOT_GOAL_TONNES}t goal
              </div>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill progress-fill--green"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <div className="panel-hint">Personal progress against the pilot tonne goal</div>
          </div>

          <div className="panel panel--pad">
            <div className="panel-label">BY MATERIAL STREAM</div>
            <div className="stream-list">
              {streams.map(([label, kg]) => (
                <div key={label}>
                  <div className="stream-row">
                    <div className="stream-label">{label}</div>
                    <div className="stream-kg">{kg.toLocaleString()} kg</div>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.round((kg / smax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="carbon-card">
            <div className="carbon-card-label">EQUIVALENT TO</div>
            <div className="equiv-list">
              <div>{trees.toLocaleString()} tree seedlings grown for 10 years</div>
              <div>{petrol.toLocaleString()} litres of petrol not burned</div>
              <div>{flights} return Lagos–Abuja flights avoided</div>
            </div>
            <div className="carbon-card-foot">
              Estimates from LCA reference values. Not certified offsets.
            </div>
          </div>
        </div>
      </div>

      <div className="panel panel--flush table-scroll impact-txns">
        <div className="panel-head">
          <div className="panel-label">RECENT COMPLETED EXCHANGES</div>
        </div>
        <div className="txn-head">
          <div>MATERIAL</div>
          <div>COUNTERPARTY</div>
          <div>WEIGHT</div>
          <div>VALUE</div>
          <div>CO₂e SAVED</div>
          <div>DATE</div>
        </div>
        {data.recent.length === 0 ? (
          <div className="txn-row">
            <div className="txn-material" style={{ gridColumn: "1 / -1" }}>
              No completed exchanges yet. In Messages, tap Mark completed after a deal.
            </div>
          </div>
        ) : (
          data.recent.map((t) => (
            <div key={`${t.material}-${t.date}-${t.party}`} className="txn-row">
              <div className="txn-material">{t.material}</div>
              <div className="txn-party">{t.party}</div>
              <div className="txn-mono">{t.weight} kg</div>
              <div className="txn-mono">₦{t.value}</div>
              <div className="txn-co2">{t.co2} kg</div>
              <div className="txn-date">{t.date}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
