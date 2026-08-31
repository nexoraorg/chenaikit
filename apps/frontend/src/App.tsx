import { useState } from "react";
import { TopNav, View } from "./components/TopNav";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";

export function App() {
  const [view, setView] = useState<View>("landing");

  return (
    <ErrorBoundary>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="ledger-margin" />
      <TopNav view={view} onChange={setView} />
      <div id="main-content">
        {/* Keyed on `view` so switching views after a caught error remounts
            the page instead of re-rendering into a boundary still tripped
            by the previous page's error. */}
        <ErrorBoundary key={view}>
          {view === "landing" ? <Landing /> : <Dashboard />}
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
