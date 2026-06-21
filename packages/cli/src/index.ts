import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import path from 'path';
import { registerAccountCommand } from './commands/account';
import { registerTransactionCommand } from './commands/transaction';
import { registerCreditScoreCommand } from './commands/credit-score';
import { registerFraudCommand } from './commands/fraud';

function getVersion(): string {
	try {
		const pkgPath = path.resolve(__dirname, '..', 'package.json');
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
		return pkg.version ?? '0.0.0';
	} catch (_) {
		return '0.0.0';
	}
}

function handleCliError(error: unknown, debug = false): void {
	console.error(chalk.red('An unexpected error occurred while running chenAIkit.'));
	if (error instanceof Error) {
		console.error(chalk.red(error.message));
		if (debug && error.stack) {
			console.error(chalk.gray(error.stack));
		}
	} else {
		console.error(chalk.red(String(error)));
	}
	console.log(chalk.gray('Run with --debug for more details.'));
	process.exitCode = 1;
}

export async function run(argv: string[] = process.argv): Promise<void> {
	const program = new Command();
	program
		.name('chenaikit')
		.description('ChenAIKit CLI — AI-powered blockchain toolkit')
		.version(getVersion())
		.option('-d, --debug', 'Enable verbose error output', false)
		.showHelpAfterError('(use --help for usage)');

	registerAccountCommand(program);
	registerTransactionCommand(program);
	registerCreditScoreCommand(program);
	registerFraudCommand(program);

	program.addHelpText(
		'after',
		`\nExamples:\n  $ chenaikit account create\n  $ chenaikit account balance G...\n  $ chenaikit transaction send --amount 10 --destination G...\n  $ chenaikit credit-score calculate\n  $ chenaikit fraud-detect analyze tx-123`
	);

	try {
		await program.parseAsync(argv);
	} catch (error) {
		const opts = program.opts<{ debug?: boolean }>();
		handleCliError(error, Boolean(opts.debug));
	}
}

if (require.main === module) {
	run();
}
