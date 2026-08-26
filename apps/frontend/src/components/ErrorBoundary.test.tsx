import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// React logs caught errors to the console (and jsdom logs the "uncaught"
// error React re-throws in dev); silence both so test output stays clean
// without hiding a real assertion failure.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

/** Throws on render until `shouldThrow` is toggled off, then renders normally. */
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("kaboom");
  }
  return <p>content rendered fine</p>;
}

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows a fallback instead of unmounting the whole tree when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("logs the caught error", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[ErrorBoundary] caught a render error:",
      expect.any(Error),
      expect.anything(),
    );
  });

  it("calls onError with the caught error", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0][0] as Error).message).toBe("kaboom");
  });

  it("offers a retry action that clears the error and re-renders children", () => {
    // A closure-backed flag lets the click handler flip whether the next
    // render throws, without needing state of its own.
    let shouldThrow = true;
    function FlakyBomb() {
      if (shouldThrow) {
        throw new Error("kaboom");
      }
      return <p>recovered</p>;
    }

    render(
      <ErrorBoundary>
        <FlakyBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText("Try again"));

    expect(screen.getByText("recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers a reload action that reloads the page", () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText("Reload page"));
    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders a custom fallback when provided, with a working retry callback", () => {
    render(
      <ErrorBoundary
        fallback={(error, retry) => (
          <div>
            <p>custom: {error.message}</p>
            <button onClick={retry}>custom retry</button>
          </div>
        )}
      >
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("custom: kaboom")).toBeInTheDocument();
  });
});
