# @chenaikit/cli

Command-line interface for chenaikit.

> Command actions are placeholders while the package is being filled in.
> The **input validation** behavior described below is final: every
> invocation is fully validated before any action runs.

## Usage

```
chenaikit <command> [options]
```

| Command  | Option           | Required | Constraints                                  |
| -------- | ---------------- | -------- | -------------------------------------------- |
| `deploy` | `--network`      | yes      | one of: `local`, `testnet`, `futurenet`       |
|          | `--wasm`         | yes      | path to an existing file                      |
|          | `--contract-id`  | no       | free-form value                               |
| `attest` | `--model`        | yes      | path to an existing file                      |
|          | `--verdict`      | yes      | one of: `approved`, `rejected`                |
| `info`   | `--format`       | no       | one of: `text`, `json` (default: `text`)      |

Options are passed as `--flag value` or `--flag=value`. Global flags:

- `--help` / `-h` — general or per-command usage (`chenaikit deploy --help`)
- `--version` / `-v` — print the CLI version

## Invalid input behavior

Invalid input never triggers a command action. The CLI:

1. prints a single-line error on stderr that **names the offending option**
   (or command) and what was wrong with it,
2. prints the matching `usage:` line as guidance,
3. exits with code `2`.

Valid invocations exit `0`; only `--help`/`--version` and successful
commands do. Any other failure mode is nonzero.

### Examples

Missing required options (all of them are reported together):

```
$ chenaikit deploy
error: missing required options for "deploy": --network, --wasm
usage: chenaikit deploy [options] (run "chenaikit deploy --help")
```

Invalid enumerated value:

```
$ chenaikit deploy --network devnet --wasm ./contract.wasm
error: invalid value "devnet" for --network — expected one of: local, testnet, futurenet
usage: chenaikit deploy [options] (run "chenaikit deploy --help")
```

Path that does not exist:

```
$ chenaikit deploy --network testnet --wasm ./missing.wasm
error: --wasm: no such file: ./missing.wasm
usage: chenaikit deploy [options] (run "chenaikit deploy --help")
```

Unknown command (with a suggestion when close):

```
$ chenaikit deplo
error: unknown command "deplo" — did you mean "deploy"?, run "chenaikit --help" to list commands
usage: chenaikit <command> [options] (run "chenaikit --help")
```

Other rejected inputs follow the same pattern: unknown options for the chosen
command, duplicate options, missing option values, empty values, stray
positional arguments, and options passed before a command.

## Development

```bash
pnpm --filter @chenaikit/cli build   # tsc → dist/
pnpm --filter @chenaikit/cli test    # vitest
```

Run it locally after building:

```bash
node packages/cli/dist/index.js info
node packages/cli/dist/index.js deploy --help
```

## Programmatic use

```ts
import { run, EXIT_USAGE } from "@chenaikit/cli";

const code = await run(process.argv.slice(2));
if (code === EXIT_USAGE) {
  // invalid input; diagnostics were written to stderr
}
```

`run()` returns the exit code instead of calling `process.exit`, so embedders
stay in control. Validation failures throw `UsageError` from the exported
helpers (`parseOptionValues`, `validateOptionValues`) if you need them à la
carte.
