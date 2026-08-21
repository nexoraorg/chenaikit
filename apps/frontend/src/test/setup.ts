// Vitest setup for component tests — extends `expect` with jsdom-aware
// matchers (toBeInTheDocument, etc.) and cleans up the DOM between tests.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
