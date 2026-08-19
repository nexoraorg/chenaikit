import React from "react";

export type View = "landing" | "dashboard";

export function TopNav({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <div className="brand">
          <span className="dot" />
          chenaikit
        </div>
        <div className="navlinks">
          <button
            className={view === "landing" ? "active" : ""}
            onClick={() => onChange("landing")}
          >
            Overview
          </button>
          <button
            className={view === "dashboard" ? "active" : ""}
            onClick={() => onChange("dashboard")}
          >
            Dashboard
          </button>
        </div>
      </div>
    </nav>
  );
}
