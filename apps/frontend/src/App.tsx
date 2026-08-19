import React, { useState } from "react";
import { TopNav, View } from "./components/TopNav";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";

export function App() {
  const [view, setView] = useState<View>("landing");

  return (
    <>
      <div className="ledger-margin" />
      <TopNav view={view} onChange={setView} />
      {view === "landing" ? <Landing /> : <Dashboard />}
    </>
  );
}
