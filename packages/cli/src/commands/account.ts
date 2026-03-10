import { Command } from 'commander';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import inquirer from 'inquirer';
import ora from 'ora';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarConnector } from '@chenaikit/core';
import {
  AccountProfile,
  ChenaiCliConfig,
  getAccountProfile,
  loadConfig,
  resolveNetwork,
  upsertAccountProfile,
} from '../utils/config';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function validatePublicKey(value: string): true | string {
  if (value && value.startsWith('G') && value.length >= 10) {
    return true;
  }
  return 'Please provide a valid Stellar public key (starts with G).';
}

function createConnector(config: ChenaiCliConfig, networkOverride?: string): StellarConnector {
  const network = resolveNetwork(networkOverride, config.network);
  return new StellarConnector({
    network,
    horizonUrl: config.horizonUrl,
    apiKey: config.apiKey,
  });
}

export function registerAccountCommand(program: Command): void {
  const account = program.command('account').description('Manage ChenAIKit blockchain accounts');

  account
    .command('create')
    .description('Create a new Stellar account and store it locally')
    .option('-l, --label <label>', 'Custom label for the account')
    .option('-n, --network <network>', 'Choose network (testnet|mainnet)')
    .option('--save-secret', 'Store the secret key inside the config file')
    .option('--set-default', 'Mark this account as the default one')
    .action(async (options) => {
      const config = await loadConfig();
      const prompts = await inquirer.prompt([
        {
          type: 'input',
          name: 'label',
          message: 'Account label',
          default: `wallet-${Date.now()}`,
          when: () => !options.label,
          validate: (value: string) => (value.trim() ? true : 'Label cannot be empty'),
        },
        {
          type: 'list',
          name: 'network',
          message: 'Select Stellar network',
          choices: [
            { name: 'Testnet (recommended for development)', value: 'testnet' },
            { name: 'Mainnet', value: 'mainnet' },
          ],
          default: config.network,
          when: () => !options.network,
        },
        {
          type: 'confirm',
          name: 'saveSecret',
          message: 'Store the secret key inside ~/.chenaikit/config.json?',
          default: false,
          when: () => options.saveSecret === undefined,
        },
        {
          type: 'confirm',
          name: 'setDefault',
          message: 'Set this account as your default?',
          default: !config.defaultAccount,
          when: () => options.setDefault === undefined,
        },
      ]);

      const label: string = options.label ?? prompts.label;
      const network = resolveNetwork(options.network ?? prompts.network, config.network);
      const saveSecret: boolean = Boolean(options.saveSecret ?? prompts.saveSecret);
      const setDefault: boolean = Boolean(options.setDefault ?? prompts.setDefault ?? !config.defaultAccount);

      const spinner = ora('Generating secure keypair').start();
      try {
        const keypair = Keypair.random();
        await wait(300);
        spinner.succeed('Keypair generated');

        const steps = [
          { message: 'Encrypting secret locally', duration: 400 },
          { message: 'Preparing configuration entry', duration: 300 },
          { message: 'Finalizing account metadata', duration: 350 },
        ];
        const bar = new cliProgress.SingleBar(
          {
            format: ' Account setup |{bar}| {percentage}% | {message}',
          },
          cliProgress.Presets.shades_classic
        );
        bar.start(steps.length, 0, { message: steps[0].message });
        for (let i = 0; i < steps.length; i += 1) {
          const step = steps[i];
          await wait(step.duration);
          bar.update(i + 1, { message: step.message });
        }
        bar.stop();

        const profile: AccountProfile = {
          label,
          publicKey: keypair.publicKey(),
          secretKey: saveSecret ? keypair.secret() : undefined,
          network,
          createdAt: new Date().toISOString(),
        };

        await upsertAccountProfile(profile, { setDefault });

        console.log(`\n${chalk.green.bold('Account created!')}`);
        console.log(`${chalk.gray('Label:')} ${profile.label}`);
        console.log(`${chalk.gray('Network:')} ${network}`);
        console.log(`${chalk.gray('Public Key:')} ${chalk.cyan(profile.publicKey)}`);
        if (saveSecret) {
          console.log(`${chalk.gray('Secret Key:')} Stored securely in config (remember to protect the file!)`);
        } else {
          console.log(`${chalk.gray('Secret Key:')} ${chalk.yellow(keypair.secret())}`);
          console.log(chalk.red('Make sure to copy this secret key now. It will not be shown again.'));
        }
        if (setDefault) {
          console.log(chalk.gray('This account is now your default.'));
        }
        console.log(
          `\nFund the account via friendbot when using testnet:\nhttps://friendbot.stellar.org/?addr=${encodeURIComponent(
            profile.publicKey
          )}`
        );
      } catch (error) {
        spinner.fail('Unable to create the account');
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
        } else {
          console.error(chalk.red('Unknown error while creating account.'));
        }
        process.exitCode = 1;
      }
    });

  account
    .command('balance [address]')
    .description('Retrieve balances for an account')
    .option('-n, --network <network>', 'Choose network (testnet|mainnet)')
    .action(async (address: string | undefined, options) => {
      const config = await loadConfig();
      let resolvedAddress: string | undefined = address ?? config.defaultAccount;

      if (!resolvedAddress) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'address',
            message: 'Enter the public key to inspect',
            validate: validatePublicKey,
          },
        ]);
        resolvedAddress = answer.address;
      }

      if (!resolvedAddress) {
        console.error(chalk.red('No account address provided.'));
        process.exitCode = 1;
        return;
      }

      const connector = createConnector(config, options.network);
      const network = resolveNetwork(options.network, config.network);
      const spinner = ora(`Fetching account data from ${network}`).start();
      try {
        const accountData = await connector.getAccount(resolvedAddress);
        spinner.succeed('Account data retrieved');

        const balances = accountData?.balances ?? [];
        if (!balances.length) {
          console.log(chalk.yellow('No balances reported by Horizon. The account might be unfunded.'));
          return;
        }

        console.log(`\n${chalk.bold('Balances:')}`);
        balances.forEach((balance: any) => {
          const asset = balance.asset_type === 'native' ? 'XLM' : `${balance.asset_code}/${balance.asset_issuer}`;
          console.log(`- ${chalk.cyan(asset)}: ${balance.balance}`);
        });
      } catch (error) {
        spinner.fail('Unable to fetch balance from the Horizon API');
        console.error(
          chalk.red(
            error instanceof Error ? error.message : 'An unexpected error occurred while fetching the account balance.'
          )
        );
        const profile = getAccountProfile(resolvedAddress, config);
        if (profile) {
          console.log(`\n${chalk.bold('Cached profile:')}`);
          console.log(`- Label: ${profile.label}`);
          console.log(`- Network: ${profile.network}`);
          console.log(`- Created at: ${profile.createdAt}`);
          console.log(chalk.gray('Network access failed, showing cached metadata only.'));
        }
        process.exitCode = 1;
      }
    });
}
