import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BIN_NAME,
  COMMANDS,
  EXIT_USAGE,
  parseOptionValues,
  run,
  UsageError,
  validateOptionValues,
  VERSION,
  type CliIo,
} from "./index.js";

const DEPLOY = COMMANDS.find((command) => command.name === "deploy")!;

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = {
    stdout: (message) => out.push(message),
    stderr: (message) => err.push(message),
  };
  return { io, out, err };
}

// Created at module scope so fixture paths are resolved before the `cases`
// table below is built during describe() collection.
const workDir = mkdtempSync(join(tmpdir(), "chenaikit-cli-"));
const wasmFile = join(workDir, "contract.wasm");
const modelFile = join(workDir, "model.onnx");
writeFileSync(wasmFile, "fake-wasm");
writeFileSync(modelFile, "fake-model");

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("run — invalid input", () => {
  const cases: { name: string; argv: string[]; expectMentions: string[] }[] = [
    {
      name: "missing all required options",
      argv: ["deploy"],
      expectMentions: ["--network", "--wasm"],
    },
    {
      name: "missing one required option",
      argv: ["deploy", "--network", "testnet"],
      expectMentions: ["--wasm"],
    },
    {
      name: "invalid enumerated value",
      argv: ["deploy", "--network", "devnet", "--wasm", "x.wasm"],
      expectMentions: ["--network", "local, testnet, futurenet"],
    },
    {
      name: "nonexistent path",
      argv: ["deploy", "--network", "testnet", "--wasm", "./does-not-exist.wasm"],
      expectMentions: ["--wasm", "does-not-exist.wasm"],
    },
    {
      name: "unknown command with suggestion",
      argv: ["deplo"],
      expectMentions: ['"deplo"', "deploy"],
    },
    {
      name: "unknown command without suggestion",
      argv: ["frobnicate"],
      expectMentions: ["frobnicate"],
    },
    {
      name: "option unknown to the chosen command",
      argv: ["info", "--wasm", wasmFile],
      expectMentions: ["--wasm", '"info"'],
    },
    {
      name: "flag without a value",
      argv: ["deploy", "--network"],
      expectMentions: ["--network"],
    },
    {
      name: "empty option value",
      argv: ["attest", "--model", modelFile, "--verdict", " "],
      expectMentions: ["--verdict"],
    },
    {
      name: "duplicate option",
      argv: ["deploy", "--network", "testnet", "--network", "local", "--wasm", wasmFile],
      expectMentions: ["--network"],
    },
    {
      name: "stray positional argument",
      argv: ["deploy", "extra", "--network", "testnet", "--wasm", wasmFile],
      expectMentions: ["extra"],
    },
    {
      name: "options before a command",
      argv: ["--network", "testnet"],
      expectMentions: ["--network", "expected a command"],
    },
    {
      name: "no arguments at all",
      argv: [],
      expectMentions: ["no command given"],
    },
  ];

  for (const { name, argv, expectMentions } of cases) {
    it(`exit ${EXIT_USAGE} + names the culprit: ${name}`, async () => {
      const { io, err } = capture();
      const code = await run(argv, io);

      expect(code).toBe(EXIT_USAGE);
      for (const fragment of expectMentions) {
        expect(err.join("\n")).toContain(fragment);
      }
      expect(err.join("\n")).toMatch(/^error: /m);
      expect(err.join("\n")).toContain("usage:");
    });
  }

  it("path pointing at a directory is rejected", async () => {
    const { io, err } = capture();
    const code = await run(["attest", "--model", workDir, "--verdict", "approved"], io);
    expect(code).toBe(EXIT_USAGE);
    expect(err.join("\n")).toContain("--model");
  });
});

describe("run — valid input", () => {
  it("info defaults to text output and exit 0", async () => {
    const { io, out } = capture();
    expect(await run(["info"], io)).toBe(0);
    expect(out.join("\n")).toBe(`${BIN_NAME} ${VERSION}`);
  });

  it("info --format json emits valid JSON", async () => {
    const { io, out } = capture();
    expect(await run(["info", "--format", "json"], io)).toBe(0);
    expect(JSON.parse(out.join(""))).toEqual({ name: BIN_NAME, version: VERSION });
  });

  it("deploy with valid enum + existing file exits 0", async () => {
    const { io, out } = capture();
    const code = await run(
      ["deploy", "--network", "testnet", "--wasm", wasmFile, "--contract-id", "abc123"],
      io,
    );
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("testnet");
    expect(out.join("\n")).toContain(wasmFile);
  });

  it("deploy accepts --flag=value syntax", async () => {
    const { io, out } = capture();
    const code = await run(["deploy", `--wasm=${wasmFile}`, "--network=futurenet"], io);
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("futurenet");
  });

  it("attest with valid path + verdict exits 0", async () => {
    const { io } = capture();
    expect(await run(["attest", "--model", modelFile, "--verdict", "rejected"], io)).toBe(0);
  });

  it("--version exits 0", async () => {
    const { io, out } = capture();
    expect(await run(["--version"], io)).toBe(0);
    expect(out.join("\n")).toContain(VERSION);
  });

  it("--help prints general usage and exits 0", async () => {
    const { io, out } = capture();
    expect(await run(["--help"], io)).toBe(0);
    expect(out.join("\n")).toContain("commands:");
  });

  it("<command> --help prints that command's options", async () => {
    const { io, out } = capture();
    expect(await run(["deploy", "--help"], io)).toBe(0);
    expect(out.join("\n")).toContain("--network");
    expect(out.join("\n")).toContain("--wasm");
  });
});

describe("unit-level validation helpers", () => {
  it("validateOptionValues names every missing required option", () => {
    try {
      validateOptionValues(DEPLOY, {});
      throw new Error("expected UsageError");
    } catch (error) {
      expect(error).toBeInstanceOf(UsageError);
      expect((error as Error).message).toContain("--network");
      expect((error as Error).message).toContain("--wasm");
    }
  });

  it("parseOptionValues is scoped to the given command", () => {
    const info = COMMANDS.find((c) => c.name === "info")!;
    expect(parseOptionValues(info, ["--format", "json"])).toEqual({ format: "json" });
    expect(() => parseOptionValues(info, ["--bogus", "1"])).toThrow(/unknown option/);
  });
});
