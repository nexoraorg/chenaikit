import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopNav } from "./TopNav";

describe("TopNav", () => {
  it("renders the brand and both nav links", () => {
    render(<TopNav view="landing" onChange={() => {}} />);

    expect(screen.getByText("chenaikit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("marks the current view's link active and leaves the other inactive", () => {
    render(<TopNav view="dashboard" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Overview" })).not.toHaveClass("active");
  });

  it("calls onChange with 'dashboard' when the Dashboard link is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TopNav view="landing" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Dashboard" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("dashboard");
  });

  it("calls onChange with 'landing' when the Overview link is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TopNav view="dashboard" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Overview" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("landing");
  });
});
