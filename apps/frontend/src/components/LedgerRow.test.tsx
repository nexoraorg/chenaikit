import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerRow } from "./LedgerRow";
import { Stamp } from "./Stamp";

describe("LedgerRow", () => {
  it("renders the glyph, name, and description", () => {
    render(
      <LedgerRow
        glyph="🧠"
        name="AI integrations"
        description="Call a model, get a decision."
        status="Core"
      />,
    );

    expect(screen.getByText("🧠")).toBeInTheDocument();
    expect(screen.getByText("AI integrations")).toBeInTheDocument();
    expect(screen.getByText("Call a model, get a decision.")).toBeInTheDocument();
  });

  it("renders arbitrary status content, including a Stamp element", () => {
    render(
      <LedgerRow
        glyph="🔗"
        name="Blockchain connectors"
        description="Simple APIs for Stellar."
        status={<Stamp color="blue">Core</Stamp>}
      />,
    );

    const status = screen.getByText("Core");
    expect(status).toBeInTheDocument();
    expect(status).toHaveClass("stamp", "blue");
  });
});
