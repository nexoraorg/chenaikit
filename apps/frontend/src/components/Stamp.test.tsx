import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stamp } from "./Stamp";

describe("Stamp", () => {
  it("defaults to the red color and is not faded", () => {
    render(<Stamp>Open Source</Stamp>);

    const stamp = screen.getByText("Open Source");
    expect(stamp).toHaveClass("stamp", "red");
    expect(stamp).not.toHaveClass("faded");
  });

  it("applies the requested color and faded modifier", () => {
    render(
      <Stamp color="blue" faded>
        Core
      </Stamp>,
    );

    const stamp = screen.getByText("Core");
    expect(stamp).toHaveClass("stamp", "blue", "faded");
  });
});
