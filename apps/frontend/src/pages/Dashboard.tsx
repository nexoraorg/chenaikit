import React, { useState } from "react";
import { Stamp } from "../components/Stamp";

const NAV_GROUPS = [
  {
    label: "Monitor",
    items: [
      { icon: "📊", name: "Overview", active: true },
      { icon: "🧠", name: "Credit scoring" },
      { icon: "🚩", name: "Fraud detection" },
      { icon: "🔗", name: "Oracle network" },
    ],
  },
  {
    label: "Build",
    items: [
      { icon: "📄", name: "Contracts" },
      { icon: "🎯", name: "CLI activity" },
    ],
  },
  {
    label: "Account",
    items: [{ icon: "⚙️", name: "Settings" }],
  },
];

const STATS = [
  { label: "Decisions today", value: "1,204", delta: "▲ 8.2% vs yesterday", dir: "up" },
  { label: "Avg. credit score", value: "693", delta: "▲ 1.1%", dir: "up" },
  { label: "Fraud flags", value: "17", delta: "▲ 3 vs yesterday", dir: "down" },
  { label: "Oracle uptime", value: "99.97%", delta: "30-day avg", dir: "up" },
] as const;

const ENTRIES = [
  { account: "GC3F...K91X", model: "credit-score", score: "742", status: "approved", time: "0:02 ago" },
  { account: "GA7B...M2QZ", model: "fraud-detect", score: "—", status: "flagged", time: "0:41 ago" },
  { account: "GD9K...T4LP", model: "credit-score", score: "681", status: "approved", time: "1:15 ago" },
  { account: "GE2N...W8YV", model: "fraud-detect", score: "—", status: "pending", time: "2:03 ago" },
  { account: "GF5H...R3UB", model: "credit-score", score: "598", status: "flagged", time: "3:47 ago" },
] as const;

type EntryStatus = (typeof ENTRIES)[number]["status"];
type SortKey = "time" | "account" | "model" | "score";

const STATUS_OPTIONS: EntryStatus[] = ["approved", "flagged", "pending"];

export function Dashboard() {
  const [statusFilter, setStatusFilter] = useState<EntryStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = ENTRIES.filter(
    (e) => statusFilter === "all" || e.status === statusFilter
  );

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = a[sortBy].localeCompare(b[sortBy]);
    // 对于 score 列，数值比较
    if (sortBy === "score") {
      const nA = parseInt(a.score, 10);
      const nB = parseInt(b.score, 10);
      if (isNaN(nA) && isNaN(nB)) return dir * cmp;
      if (isNaN(nA)) return 1;
      if (isNaN(nB)) return -1;
      return dir * (nA - nB);
    }
    return dir * cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortBy !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {NAV_GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            <div className="grp-label">{group.label}</div>
            {group.items.map((item) => (
              <a
                href="#"
                key={item.name}
                className={"active" in item && item.active ? "active" : ""}
              >
                {item.icon} {item.name}
              </a>
            ))}
          </React.Fragment>
        ))}
      </aside>

      <main className="main">
        <div className="app-header">
          <div>
            <h1>Overview</h1>
            <div className="sub">stellar-testnet · last synced 12s ago</div>
          </div>
          <Stamp color="blue">Testnet</Stamp>
        </div>

        <div className="stat-grid">
          {STATS.map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="label">{s.label}</div>
              <div className="value">{s.value}</div>
              <div className={`delta ${s.dir}`}>{s.delta}</div>
            </div>
          ))}
        </div>

        <div className="filter-bar">
          <div className="filter-group">
            <span className="filter-label">Status</span>
            <button
              className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                className={`filter-chip ${statusFilter === s ? "active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-label">Sort</span>
            <button
              className={`filter-chip ${sortBy === "time" ? "active" : ""}`}
              onClick={() => toggleSort("time")}
            >
              Time{sortArrow("time")}
            </button>
            <button
              className={`filter-chip ${sortBy === "account" ? "active" : ""}`}
              onClick={() => toggleSort("account")}
            >
              Account{sortArrow("account")}
            </button>
            <button
              className={`filter-chip ${sortBy === "model" ? "active" : ""}`}
              onClick={() => toggleSort("model")}
            >
              Model{sortArrow("model")}
            </button>
            <button
              className={`filter-chip ${sortBy === "score" ? "active" : ""}`}
              onClick={() => toggleSort("score")}
            >
              Score{sortArrow("score")}
            </button>
          </div>
        </div>

        <div className="table-head">
          <p className="panel-title">Recent ledger entries</p>
          <span className="result-count">
            {sorted.length} of {ENTRIES.length}
          </span>
        </div>

        {sorted.length > 0 ? (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Model</th>
                <th>Score</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.account + e.time}>
                  <td>{e.account}</td>
                  <td>{e.model}</td>
                  <td>{e.score}</td>
                  <td>
                    <span className={`pill ${e.status}`}>{e.status}</span>
                  </td>
                  <td>{e.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            No entries match the current filter.
          </div>
        )}
      </main>
    </div>
  );
}