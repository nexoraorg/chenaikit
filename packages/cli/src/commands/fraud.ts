import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { FraudDetector } from '@chenaikit/core';
import { loadConfig } from '../utils/config';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FraudTransaction = Parameters<FraudDetector['score']>[0];

function classifyRisk(score: number): string {
  if (score >= 80) return `${chalk.red('High risk')}`;
  if (score >= 50) return `${chalk.yellow('Medium risk')}`;
  return `${chalk.green('Low risk')}`;
}

export function registerFraudCommand(program: Command): void {
  const fraud = program.command('fraud-detect').description('Analyze transactions for potential fraud');

  fraud
    .command('analyze <transactionId>')
    .description('Run the fraud detector on a transaction')
    .option('-a, --account <accountId>', 'Owning account for the transaction')
    .action(async (transactionId: string, options) => {
      const config = await loadConfig();
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'accountId',
          message: 'Which account initiated the transaction?',
          default: options.account ?? config.defaultAccount,
          validate: (value: string) => (value ? true : 'Account id is required'),
        },
        {
          type: 'number',
          name: 'amount',
          message: 'Transaction amount (USD equivalent)',
          default: 250,
          validate: (value: number) => (value > 0 ? true : 'Amount must be positive'),
        },
        {
          type: 'input',
          name: 'currency',
          message: 'Currency code',
          default: 'USD',
        },
        {
          type: 'input',
          name: 'merchantCategory',
          message: 'Merchant category',
          default: 'ecommerce',
        },
        {
          type: 'list',
          name: 'channel',
          message: 'Channel',
          choices: [
            { name: 'Point of sale', value: 'pos' },
            { name: 'Online', value: 'online' },
            { name: 'ATM', value: 'atm' },
            { name: 'Transfer', value: 'transfer' },
          ],
          default: 'online',
        },
        {
          type: 'input',
          name: 'country',
          message: 'Country (ISO code)',
          default: 'US',
        },
        {
          type: 'input',
          name: 'ipAddress',
          message: 'Origin IP (optional)',
        },
      ]);

      const transaction: FraudTransaction = {
        id: transactionId,
        accountId: answers.accountId,
        amount: Number(answers.amount),
        currency: answers.currency,
        merchantCategory: answers.merchantCategory,
        channel: answers.channel,
        country: answers.country,
        ipAddress: answers.ipAddress || undefined,
        timestamp: Date.now(),
      };

      const detector = new FraudDetector();
      const spinner = ora('Scoring transaction for fraud risk').start();
      let riskScore = 0;
      let reasons: string[] = [];
      let fallback = false;

      try {
        await wait(200);
        const result = await detector.score(transaction);
        spinner.succeed('Fraud analysis completed');
        riskScore = result.riskScore;
        reasons = result.reasons ?? [];
      } catch (error) {
        fallback = true;
        spinner.warn('Realtime fraud model unavailable, using heuristic scoring');
        riskScore = Math.min(100, Math.round(transaction.amount / 20 + (transaction.channel === 'online' ? 25 : 0)));
        if (transaction.country && !['US', 'CA', 'GB', 'DE'].includes(transaction.country.toUpperCase())) {
          riskScore += 10;
        }
        if (transaction.ipAddress) {
          reasons.push(`IP flagged for manual review (${transaction.ipAddress})`);
        }
        if (transaction.amount > 5000) {
          reasons.push('High-value transfer requires verification');
        }
        if (!reasons.length) {
          reasons.push('Limited telemetry available, defaulting to manual follow-up');
        }
        riskScore = Math.min(100, riskScore);
        if (error instanceof Error) {
          console.log(chalk.gray(`Reason: ${error.message}`));
        }
      }

      console.log(`\n${chalk.bold('Fraud score for transaction')} ${chalk.cyan(transactionId)}`);
      console.log(`Risk score: ${riskScore} (${classifyRisk(riskScore)})`);
      console.log(`Account: ${transaction.accountId}`);
      console.log(`Amount: ${transaction.amount} ${transaction.currency}`);
      console.log(`Channel: ${transaction.channel}`);
      console.log(`Country: ${transaction.country}`);
      if (transaction.ipAddress) {
        console.log(`IP Address: ${transaction.ipAddress}`);
      }

      console.log(`\n${chalk.bold('Reasons:')}`);
      reasons.slice(0, 5).forEach((reason) => console.log(`- ${reason}`));

      if (fallback) {
        console.log(chalk.yellow('\nFraud detector is using a heuristic fallback until the core model is available.'));
      }
    });
}
