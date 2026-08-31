// @chenaikit/cli — Command-line interface for chenaikit
//
// Commands are declared declaratively via `CommandSpec` so every invocation is
// validated (required options, enumerated values, paths) before any action
// runs. Validation failures raise `UsageError`, which `run()` converts into a
// concise stderr message plus a nonzero exit code.

import { existsSync, realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
/**
 * @chenaikit/cli — Command-line interface for chenaikit
 */

export const VERSION = "0.1.0";
export const BIN_NAME = "chenaikit";

/** Exit code used for every invalid-input / usage error. */
export const EXIT_USAGE = 2;

/** Error thrown for any invalid CLI input; `option` names the culprit flag. */
export class UsageError extends Error {
  readonly option?: string;

  constructor(message: string, option?: string) {
    super(message);
    this.name = "UsageError";
    this.option = option;
  }
}

export interface OptionSpec {
  /** Long name without leading dashes, e.g. `"network"` → `--network`. */
  readonly name: string;
  readonly description: string;
  /** When set, omitting the option is a usage error. */
  readonly required?: boolean;
  /** Restrict the value to this closed set. */
  readonly choices?: readonly string[];
  /** Value must reference an existing file on disk. */
  readonly path?: boolean;
  /** Applied when the option is omitted and not required. */
  readonly default?: string;
}

export interface CommandSpec {
  readonly name: string;
  readonly description: string;
  readonly options: readonly OptionSpec[];
  execute?: (values: Readonly<Record<string, string>>, io: CliIo) => void;
}

export interface CliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

export const consoleIo: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
};

const NETWORKS = ["local", "testnet", "futurenet"] as const;
const FORMATS = ["text", "json"] as const;
const VERDICTS = ["approved", "rejected"] as const;

/**
 * Command registry. Actions are placeholders until real implementations land;
 * the validation behavior defined here is final.
 */
export const COMMANDS: readonly CommandSpec[] = [
  {
    name: "deploy",
    description: "Deploy a compiled Soroban contract wasm bundle.",
    options: [
      { name: "network", description: "target network", required: true, choices: NETWORKS },
      { name: "wasm", description: "compiled .wasm bundle", required: true, path: true },
      { name: "contract-id", description: "existing contract id to redeploy" },
    ],
    execute: (values, io) => {
      io.stdout(
        `[dry-run] deploy ${values["wasm"]} to ${values["network"]}` +
          (values["contract-id"] ? ` as ${values["contract-id"]}` : ""),
      );
    },
  },
  {
    name: "attest",
    description: "Record an attestation verdict for an ML model artifact.",
    options: [
      { name: "model", description: "path to the model artifact", required: true, path: true },
      { name: "verdict", description: "attestation outcome", required: true, choices: VERDICTS },
    ],
    execute: (values, io) => {
      io.stdout(`[dry-run] attest ${values["model"]} as ${values["verdict"]}`);
    },
  },
  {
    name: "info",
    description: "Show CLI name and version.",
    options: [{ name: "format", description: "output format", choices: FORMATS, default: "text" }],
    execute: (values, io) => {
      if (values["format"] === "json") {
        io.stdout(JSON.stringify({ name: BIN_NAME, version: VERSION }, null, 2));
      } else {
        io.stdout(`${BIN_NAME} ${VERSION}`);
      }
    },
  },
];

export function findCommand(name: string): CommandSpec | undefined {
  return COMMANDS.find((command) => command.name === name);
}

function optionFlag(name: string): string {
  return `--${name}`;
}

function usageLine(command?: CommandSpec): string {
  return command
    ? `usage: ${BIN_NAME} ${command.name} [options] (run "${BIN_NAME} ${command.name} --help")`
    : `usage: ${BIN_NAME} <command> [options] (run "${BIN_NAME} --help")`;
}

export function formatGeneralUsage(): string {
  return [
    usageLine(),
    "",
    "commands:",
    ...COMMANDS.map((command) => `  ${command.name.padEnd(8)}${command.description}`),
  ].join("\n");
}

export function formatCommandHelp(command: CommandSpec): string {
  return [
    usageLine(command),
    "",
    command.description,
    "",
    "options:",
    ...command.options.map((option) => {
      const requirements = [
        option.required ? "required" : undefined,
        option.choices ? `one of: ${option.choices.join(", ")}` : undefined,
        option.path ? "must be an existing file" : undefined,
        !option.required && option.default !== undefined ? `default: ${option.default}` : undefined,
      ].filter(Boolean);
      const suffix = requirements.length > 0 ? ` (${requirements.join("; ")})` : "";
      return `  ${`${optionFlag(option.name)} <value>`.padEnd(24)}${option.description}${suffix}`;
    }),
  ].join("\n");
}

/** Closest known command within edit distance 2, for "did you mean" hints. */
export function suggestCommand(input: string): string | undefined {
  const distance = (a: string, b: string): number => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diagonal = row[0]!;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const up = row[j]!;
        row[j] = Math.min(up + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = up;
      }
    }
    return row[b.length]!;
  };
  const match = COMMANDS.map((command) => ({ name: command.name, d: distance(input, command.name) }))
    .filter(({ d }) => d > 0 && d <= 2)
    .sort((a, b) => a.d - b.d)[0];
  return match?.name;
}

/**
 * Syntactic parse of a command's arguments into `--flag value` pairs.
 * Throws UsageError naming the offending option for unknown flags, missing
 * values, duplicates, or stray positional arguments.
 */
export function parseOptionValues(
  command: CommandSpec,
  argv: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const eq = token.indexOf("=");
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
    const inlineValue = eq === -1 ? undefined : token.slice(eq + 1);

    const spec = command.options.find((option) => option.name === name);
    if (!spec) {
      throw new UsageError(`unknown option "${token}" for "${command.name}"`, token);
    }
    if (Object.hasOwn(values, name)) {
      throw new UsageError(`duplicate option ${optionFlag(name)}`, optionFlag(name));
    }

    let value = inlineValue;
    if (value === undefined) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new UsageError(`${optionFlag(name)} requires a value`, optionFlag(name));
      }
      value = next;
      i++;
    }
    values[name] = value;
  }

  if (positionals.length > 0) {
    const first = positionals[0]!;
    throw new UsageError(
      `unexpected argument "${first}" for "${command.name}" — pass options as ${BIN_NAME} ${command.name} --flag value`,
      first,
    );
  }
  return values;
}

/** Semantic validation of parsed values against a command's option specs. */
export function validateOptionValues(
  command: CommandSpec,
  raw: Readonly<Record<string, string>>,
): Record<string, string> {
  const missing = command.options
    .filter(
      (option) =>
        option.required && !Object.hasOwn(raw, option.name) && option.default === undefined,
    )
    .map((option) => optionFlag(option.name));
  if (missing.length > 0) {
    throw new UsageError(
      `missing required option${missing.length > 1 ? "s" : ""} for "${command.name}": ${missing.join(", ")}`,
      missing[0],
    );
  }

  const values: Record<string, string> = {};
  for (const option of command.options) {
    const flag = optionFlag(option.name);
    const provided = Object.hasOwn(raw, option.name);
    let value = provided ? raw[option.name] : option.default;

    if (!provided && value === undefined) {
      continue;
    }
    value = value ?? "";

    if (value.trim() === "") {
      throw new UsageError(`${flag} requires a non-empty value`, flag);
    }
    if (option.choices && !option.choices.includes(value)) {
      throw new UsageError(
        `invalid value "${value}" for ${flag} — expected one of: ${option.choices.join(", ")}`,
        flag,
      );
    }
    if (option.path && !existsSync(value)) {
      throw new UsageError(`${flag}: no such file: ${value}`, flag);
    }
    if (option.path && !statSync(value).isFile()) {
      throw new UsageError(`${flag}: not a file: ${value}`, flag);
    }
    values[option.name] = value;
  }
  return values;
}

/**
 * Entry point: validates argv and executes the matching command.
 * Returns the process exit code instead of exiting, so callers (and tests)
 * can inspect it. Any invalid input yields EXIT_USAGE (nonzero).
 */
export async function run(argv: readonly string[], io: CliIo = consoleIo): Promise<number> {
  try {
    const wantsHelp = argv.includes("--help") || argv.includes("-h");
    if (argv.includes("--version") || argv.includes("-v")) {
      io.stdout(`${BIN_NAME}/${VERSION}`);
      return 0;
    }
    if (argv.length === 0 && !wantsHelp) {
      io.stderr("error: no command given");
      io.stderr(formatGeneralUsage());
      return EXIT_USAGE;
    }

    const name = argv[0];
    const command =
      name !== undefined && !name.startsWith("-") ? findCommand(name) : undefined;

    if (wantsHelp) {
      io.stdout(command ? formatCommandHelp(command) : formatGeneralUsage());
      return 0;
    }

    if (name === undefined || name.startsWith("-")) {
      throw new UsageError(
        name === undefined
          ? "no command given"
          : `expected a command before "${name}"`,
      );
    }
    if (!command) {
      const suggestion = suggestCommand(name);
      throw new UsageError(
        `unknown command "${name}"` +
          (suggestion ? ` (did you mean "${suggestion}"?)` : "") +
          ` — run "${BIN_NAME} --help" to list commands`,
        name,
      );
    }

    const raw = parseOptionValues(command, argv.slice(1));
    const values = validateOptionValues(command, raw);
    command.execute?.(values, io);
    return 0;
  } catch (error) {
    if (!(error instanceof UsageError)) {
      throw error;
    }
    io.stderr(`error: ${error.message}`);
    io.stderr(usageLine(findOrNone(argv)));
    return EXIT_USAGE;
  }
}

function findOrNone(argv: readonly string[]): CommandSpec | undefined {
  const name = argv[0];
  return name !== undefined && !name.startsWith("-") ? findCommand(name) : undefined;
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  void run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
