import { useState } from "react";
import { TopNav, View } from "./components/TopNav";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";

export function App() {
  const [view, setView] = useState<View>("landing");

  return (
    <ErrorBoundary>
      <div className="ledger-margin" />
      <TopNav view={view} onChange={setView} />
      {/* Keyed on `view` so switching views after a caught error remounts
          the page instead of re-rendering into a boundary still tripped
          by the previous page's error. */}
      <ErrorBoundary key={view}>
        {view === "landing" ? <Landing /> : <Dashboard />}
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
