import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Dashboard } from "./Dashboard";

describe("Dashboard", () => {
  it("renders the sidebar nav groups with the active item marked", () => {
    render(<Dashboard />);

    expect(screen.getByText("Monitor", { selector: ".grp-label" })).toBeInTheDocument();
    expect(screen.getByText("Build", { selector: ".grp-label" })).toBeInTheDocument();
    expect(screen.getByText("Account", { selector: ".grp-label" })).toBeInTheDocument();

    const overviewLink = screen.getByRole("link", { name: /Overview/ });
    expect(overviewLink).toHaveClass("active");

    const settingsLink = screen.getByRole("link", { name: /Settings/ });
    expect(settingsLink).not.toHaveClass("active");
  });

  it("renders a stat card for each summary metric with its value and delta", () => {
    render(<Dashboard />);

    expect(screen.getByText("Decisions today")).toBeInTheDocument();
    expect(screen.getByText("1,204")).toBeInTheDocument();
    expect(screen.getByText("▲ 8.2% vs yesterday")).toBeInTheDocument();

    expect(screen.getByText("Oracle uptime")).toBeInTheDocument();
    expect(screen.getByText("99.97%")).toBeInTheDocument();
  });

  it("renders one ledger table row per recent entry, with its status pill", () => {
    render(<Dashboard />);

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    // 5 data rows + 1 header row.
    expect(rows).toHaveLength(6);

    const approvedRow = screen.getByText("GC3F...K91X").closest("tr")!;
    expect(within(approvedRow).getByText("approved")).toHaveClass("pill", "approved");

    const flaggedRow = screen.getByText("GA7B...M2QZ").closest("tr")!;
    expect(within(flaggedRow).getByText("flagged")).toHaveClass("pill", "flagged");

    const pendingRow = screen.getByText("GE2N...W8YV").closest("tr")!;
    expect(within(pendingRow).getByText("pending")).toHaveClass("pill", "pending");
  });

  it("shows the testnet badge in the header", () => {
    render(<Dashboard />);

    expect(screen.getByText("Testnet")).toBeInTheDocument();
  });
});
