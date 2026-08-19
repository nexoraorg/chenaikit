import React from "react";
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

export function Dashboard() {
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

        <p className="panel-title">Recent ledger entries</p>
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
            {ENTRIES.map((e) => (
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
      </main>
    </div>
  );
}
