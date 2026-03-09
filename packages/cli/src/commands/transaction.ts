import { Command } from 'commander';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import inquirer from 'inquirer';
import ora from 'ora';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarConnector } from '@chenaikit/core';
import { loadConfig, resolveNetwork } from '../utils/config';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function validatePublicKey(value: string): true | string {
  if (value && value.startsWith('G') && value.length >= 10) {
    return true;
  }
  return 'Destination must be a valid Stellar public key (starts with G).';
}

function validateSecret(value: string): true | string {
  if (value && value.startsWith('S') && value.length >= 10) {
    return true;
  }
  return 'Secret keys must start with S and be at least 10 characters long.';
}

function validateAmount(value: string): true | string {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return true;
  }
  return 'Enter a positive numeric amount.';
}

export function registerTransactionCommand(program: Command): void {
  const transaction = program.command('transaction').description('Send transactions between Stellar accounts');

  transaction
    .command('send')
    .description('Send a payment transaction')
    .option('-s, --source <secret>', 'Source account secret key')
    .option('-d, --destination <address>', 'Destination public key')
    .option('-a, --amount <amount>', 'Amount to transfer')
    .option('-A, --asset <code>', 'Asset code (defaults to XLM)')
    .option('-m, --memo <memo>', 'Optional memo for the transaction')
    .option('-n, --network <network>', 'Choose network (testnet|mainnet)')
    .action(async (options) => {
      const config = await loadConfig();
      const prompts = await inquirer.prompt([
        {
          type: 'password',
          name: 'source',
          message: 'Source secret key (never shared with ChenAIKit)',
          mask: '*',
          when: () => !options.source,
          validate: validateSecret,
        },
        {
          type: 'input',
          name: 'destination',
          message: 'Destination public key',
          when: () => !options.destination,
          validate: validatePublicKey,
        },
        {
          type: 'input',
          name: 'amount',
          message: 'Amount (lumens)',
          when: () => !options.amount,
          validate: validateAmount,
        },
        {
          type: 'input',
          name: 'asset',
          message: 'Asset code',
          default: 'XLM',
          when: () => !options.asset,
        },
        {
          type: 'input',
          name: 'memo',
          message: 'Memo (optional)',
          when: () => options.memo === undefined,
        },
        {
          type: 'list',
          name: 'network',
          message: 'Select Stellar network',
          choices: [
            { name: 'Testnet (recommended)', value: 'testnet' },
            { name: 'Mainnet', value: 'mainnet' },
          ],
          default: config.network,
          when: () => !options.network,
        },
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Ready to broadcast this transaction?',
          default: true,
        },
      ]);

      if (prompts.confirm === false) {
        console.log(chalk.yellow('Transaction cancelled.'));
        return;
      }

      const sourceSecret: string = options.source ?? prompts.source;
      const destination: string = options.destination ?? prompts.destination;
      const amount: string = options.amount ?? prompts.amount;
      const asset: string = options.asset ?? prompts.asset ?? 'XLM';
      const memo: string = options.memo ?? prompts.memo ?? '';
      const network = resolveNetwork(options.network ?? prompts.network, config.network);

      let sourcePublicKey: string;
      try {
        sourcePublicKey = Keypair.fromSecret(sourceSecret).publicKey();
      } catch (error) {
        console.error(chalk.red('Invalid source secret provided.'));
        process.exitCode = 1;
        return;
      }

      console.log(`\n${chalk.bold('Transaction summary:')}`);
      console.log(`- Network: ${network}`);
      console.log(`- From: ${chalk.cyan(sourcePublicKey)}`);
      console.log(`- To: ${chalk.cyan(destination)}`);
      console.log(`- Amount: ${amount} ${asset}`);
      if (memo) {
        console.log(`- Memo: ${memo}`);
      }

      const steps = [
        { message: 'Building transaction envelope', duration: 350 },
        { message: 'Signing with provided secret', duration: 450 },
        { message: 'Preparing submission payload', duration: 300 },
      ];
      const bar = new cliProgress.SingleBar(
        {
          format: ' Transaction prep |{bar}| {percentage}% | {message}',
        },
        cliProgress.Presets.rect
      );
      bar.start(steps.length, 0, { message: steps[0].message });
      for (let i = 0; i < steps.length; i += 1) {
        await wait(steps[i].duration);
        bar.update(i + 1, { message: steps[i].message });
      }
      bar.stop();

      const spinner = ora('Submitting transaction to Horizon').start();
      const connector = new StellarConnector({
        network,
        horizonUrl: config.horizonUrl,
        apiKey: config.apiKey,
      });

      try {
        const response = await connector.submitTransaction({
          source: sourcePublicKey,
          destination,
          amount,
          asset,
          memo,
          timestamp: new Date().toISOString(),
        });
        spinner.succeed('Transaction submitted');
        console.log(`\n${chalk.green('Horizon response:')}`);
        if (response?.hash) {
          console.log(`- Hash: ${response.hash}`);
        }
        if (response?.result_xdr) {
          console.log(`- Result XDR: ${response.result_xdr}`);
        }
      } catch (error) {
        spinner.fail('Transaction submission failed');
        console.error(
          chalk.red(
            error instanceof Error ? error.message : 'An unexpected error occurred while submitting the transaction.'
          )
        );
        console.log(chalk.gray('No funds were moved. Please verify your inputs and try again.'));
        process.exitCode = 1;
      }
    });
}
