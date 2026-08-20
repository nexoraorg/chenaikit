import { useState } from "react";
import { TopNav, View } from "./components/TopNav";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";

export function App() {
  const [view, setView] = useState<View>("landing");

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="ledger-margin" />
      <TopNav view={view} onChange={setView} />
      <div id="main-content">
        {view === "landing" ? <Landing /> : <Dashboard />}
      </div>
    </>
  );
}
