import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

describe("App navigation", () => {
  it("shows the landing page by default", () => {
    render(<App />);

    expect(screen.getByText(/Wire AI into/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("switches to the dashboard when the Dashboard nav link is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Dashboard" }));

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText(/Wire AI into/)).not.toBeInTheDocument();
  });

  it("switches back to the landing page from the dashboard", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    await user.click(screen.getByRole("button", { name: "Overview" }));

    expect(screen.getByText(/Wire AI into/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
