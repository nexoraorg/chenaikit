/**
 * Structured logger for Oracle Node runtime.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  level?: LogLevel;
  sink?: (entry: Record<string, unknown>) => void;
}

export class Logger {
  private level: LogLevel;
  private sink: (entry: Record<string, unknown>) => void;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.sink = options.sink ?? ((entry) => {
      process.stdout.write(`${JSON.stringify(entry)}\n`);
    });
  }

  public debug(message: string, context: Record<string, unknown> = {}): void {
    this.log("debug", message, context);
  }

  public info(message: string, context: Record<string, unknown> = {}): void {
    this.log("info", message, context);
  }

  public warn(message: string, context: Record<string, unknown> = {}): void {
    this.log("warn", message, context);
  }

  public error(message: string, context: Record<string, unknown> = {}): void {
    this.log("error", message, context);
  }

  private log(level: LogLevel, message: string, context: Record<string, unknown>): void {
    if (LEVEL_SEVERITY[level] < LEVEL_SEVERITY[this.level]) {
      return;
    }

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: "@chenaikit/oracle-node",
      ...context,
    };

    this.sink(entry);
  }
}
