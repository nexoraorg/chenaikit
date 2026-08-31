import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index.js";

describe("core package", () => {
  it("exports package version and types", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
