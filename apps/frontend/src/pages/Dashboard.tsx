import React from "react";
import { Stamp } from "../components/Stamp";
import { useDashboard, type Stat, type LedgerEntry } from "../hooks/useDashboard";

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

function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="stat-grid">
      {stats.map((s) => (
        <div className="stat-card" key={s.label}>
          <div className="label">{s.label}</div>
          <div className="value">{s.value}</div>
          <div className={`delta ${s.dir}`}>{s.delta}</div>
        </div>
      ))}
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="stat-grid" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div className="stat-card" key={i}>
          <div className="skeleton-line w-40" />
          <div className="skeleton-line w-24 thick" />
          <div className="skeleton-line w-56" />
        </div>
      ))}
    </div>
  );
}

function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return (
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
        {entries.map((e) => (
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
  );
}

function TableSkeleton() {
  return (
    <table className="ledger-table" aria-hidden="true">
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
        {[0, 1, 2, 3, 4].map((i) => (
          <tr key={i}>
            <td><div className="skeleton-line w-24" /></td>
            <td><div className="skeleton-line w-32" /></td>
            <td><div className="skeleton-line w-16" /></td>
            <td><div className="skeleton-line w-20" /></td>
            <td><div className="skeleton-line w-24" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Dashboard() {
  const { state, retry } = useDashboard();

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

        {state.status === "loading" && (
          <>
            <StatSkeleton />
            <p className="panel-title">Recent ledger entries</p>
            <TableSkeleton />
          </>
        )}

        {state.status === "error" && (
          <div className="dashboard-state error" role="alert">
            <div className="state-icon">⚠️</div>
            <p className="state-title">Couldn't load dashboard</p>
            <p className="state-desc">{state.message}</p>
            <button className="btn ghost" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {state.status === "empty" && (
          <div className="dashboard-state empty">
            <div className="state-icon">🗂️</div>
            <p className="state-title">No ledger entries yet</p>
            <p className="state-desc">
              Once the oracle network reports activity, decisions appear here.
            </p>
            <button className="btn ghost" onClick={retry}>
              Refresh
            </button>
          </div>
        )}

        {state.status === "success" && (
          <>
            <StatCards stats={state.stats} />
            <p className="panel-title">Recent ledger entries</p>
            <LedgerTable entries={state.entries} />
          </>
        )}
      </main>
    </div>
  );
}