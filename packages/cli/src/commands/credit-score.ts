import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { CreditScorer } from '@chenaikit/core';
import { loadConfig } from '../utils/config';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ScoreInputs {
  monthlyIncome: number;
  monthlyDebt: number;
  historyYears: number;
  onTimePayments: number;
  creditUtilization: number;
}

function fallbackScore(inputs: ScoreInputs): number {
  const incomeFactor = Math.min(inputs.monthlyIncome / 10000, 1);
  const debtFactor = 1 - Math.min(inputs.monthlyDebt / 10000, 1);
  const historyFactor = Math.min(inputs.historyYears / 10, 1);
  const paymentFactor = Math.min(inputs.onTimePayments / 50, 1);
  const utilizationFactor = 1 - Math.min(inputs.creditUtilization / 100, 1);
  const raw = 300 + 550 * (0.25 * incomeFactor + 0.2 * debtFactor + 0.2 * historyFactor + 0.2 * paymentFactor + 0.15 * utilizationFactor);
  return Math.round(Math.max(300, Math.min(850, raw)));
}

function fallbackReasons(inputs: ScoreInputs): string[] {
  const reasons: string[] = [];
  if (inputs.creditUtilization > 60) {
    reasons.push('High credit utilization ratio');
  }
  if (inputs.monthlyDebt > inputs.monthlyIncome * 0.5) {
    reasons.push('Debt-to-income ratio exceeds 50%');
  }
  if (inputs.historyYears < 2) {
    reasons.push('Limited credit history');
  }
  if (inputs.onTimePayments < 12) {
    reasons.push('Fewer than 12 on-time payments');
  }
  if (!reasons.length) {
    reasons.push('Healthy repayment history detected');
  }
  return reasons;
}

export function registerCreditScoreCommand(program: Command): void {
  const creditScore = program.command('credit-score').description('AI-powered credit scoring tools');

  creditScore
    .command('calculate [address]')
    .description('Calculate the credit score for an account')
    .option('-n, --network <network>', 'Specify network used for telemetry (optional)')
    .action(async (address: string | undefined, options) => {
      const config = await loadConfig();
      let targetAddress = address ?? config.defaultAccount;

      if (!targetAddress) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'address',
            message: 'Which account should be analyzed?',
            validate: (value: string) => (value.startsWith('G') ? true : 'Enter a Stellar public key (starts with G).'),
          },
        ]);
        targetAddress = answer.address;
      }

      const profileAnswers = await inquirer.prompt([
        {
          type: 'number',
          name: 'monthlyIncome',
          message: 'Approximate monthly income (USD)',
          default: 5000,
          validate: (value: number) => (value > 0 ? true : 'Income must be positive'),
        },
        {
          type: 'number',
          name: 'monthlyDebt',
          message: 'Total monthly debt payments (USD)',
          default: 1500,
          validate: (value: number) => (value >= 0 ? true : 'Debt cannot be negative'),
        },
        {
          type: 'number',
          name: 'historyYears',
          message: 'Years of credit history',
          default: 3,
          validate: (value: number) => (value >= 0 ? true : 'History cannot be negative'),
        },
        {
          type: 'number',
          name: 'onTimePayments',
          message: 'On-time payments in the last 24 months',
          default: 18,
          validate: (value: number) => (value >= 0 ? true : 'Value cannot be negative'),
        },
        {
          type: 'number',
          name: 'creditUtilization',
          message: 'Average credit utilization (%)',
          default: 35,
          validate: (value: number) => (value >= 0 && value <= 100 ? true : 'Provide a percentage between 0 and 100'),
        },
      ]);

      const inputs: ScoreInputs = {
        monthlyIncome: Number(profileAnswers.monthlyIncome),
        monthlyDebt: Number(profileAnswers.monthlyDebt),
        historyYears: Number(profileAnswers.historyYears),
        onTimePayments: Number(profileAnswers.onTimePayments),
        creditUtilization: Number(profileAnswers.creditUtilization),
      };

      const scorer = new CreditScorer();
      const spinner = ora('Running ChenAIKit credit model').start();
      let score: number;
      let reasons: string[] = [];
      let fallbackUsed = false;

      try {
        await wait(250);
        score = await scorer.calculateScore({
          address: targetAddress,
          network: options.network ?? config.network,
          telemetry: inputs,
        });
        reasons =
          (await scorer.getScoreFactors({
            address: targetAddress,
            network: options.network ?? config.network,
            telemetry: inputs,
          })) ?? [];
        spinner.succeed('Score generated');
      } catch (error) {
        fallbackUsed = true;
        spinner.warn('Standard model unavailable, using heuristic score');
        score = fallbackScore(inputs);
        reasons = fallbackReasons(inputs);
        if (error instanceof Error) {
          console.log(chalk.gray(`Reason: ${error.message}`));
        }
      }

      const band = score >= 760 ? 'Excellent' : score >= 700 ? 'Good' : score >= 640 ? 'Fair' : 'Needs improvement';
      console.log(`\n${chalk.bold('Credit score for')} ${chalk.cyan(targetAddress)}`);
      console.log(`${chalk.gray('Score:')} ${chalk.green(score)} (${band})`);
      console.log(`${chalk.gray('Monthly DTI:')} ${((inputs.monthlyDebt / inputs.monthlyIncome) * 100).toFixed(1)}%`);
      console.log(`${chalk.gray('Utilization:')} ${inputs.creditUtilization}%`);

      console.log(`\n${chalk.bold('Key factors:')}`);
      reasons.slice(0, 5).forEach((reason) => console.log(`- ${reason}`));

      if (fallbackUsed) {
        console.log(chalk.yellow('\nModel output is estimated until @chenaikit/core implements the credit scorer.'));
      }
    });
}
