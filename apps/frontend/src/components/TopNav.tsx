export type View = "landing" | "dashboard";

export function TopNav({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <nav className="topnav" aria-label="Main navigation">
      <div className="topnav-inner">
        <div className="brand">
          <span className="dot" aria-hidden="true" />
          chenaikit
        </div>
        <div className="navlinks">
          <button
            className={view === "landing" ? "active" : ""}
            onClick={() => onChange("landing")}
            aria-current={view === "landing" ? "page" : undefined}
          >
            Overview
          </button>
          <button
            className={view === "dashboard" ? "active" : ""}
            onClick={() => onChange("dashboard")}
            aria-current={view === "dashboard" ? "page" : undefined}
          >
            Dashboard
          </button>
        </div>
      </div>
    </nav>
  );
}