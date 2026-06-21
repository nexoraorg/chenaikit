import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export type SupportedNetwork = 'testnet' | 'mainnet';

export interface AccountProfile {
  label: string;
  publicKey: string;
  secretKey?: string;
  network: SupportedNetwork;
  createdAt: string;
  notes?: string;
}

export interface ChenaiCliConfig {
  network: SupportedNetwork;
  horizonUrl: string;
  apiKey?: string;
  aiProvider: 'openai' | 'huggingface' | 'custom';
  aiApiKey?: string;
  defaultAccount?: string;
  telemetry?: boolean;
  accounts: Record<string, AccountProfile>;
}

const CONFIG_DIR = path.join(os.homedir(), '.chenaikit');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: ChenaiCliConfig = {
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  aiProvider: 'openai',
  accounts: {},
  telemetry: true,
};

function mergeConfig(partial: Partial<ChenaiCliConfig>): ChenaiCliConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    accounts: { ...DEFAULT_CONFIG.accounts, ...(partial.accounts ?? {}) },
  };
}

async function ensureConfigFile(): Promise<void> {
  try {
    await fs.access(CONFIG_PATH);
  } catch (_) {
    await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), { encoding: 'utf-8', mode: 0o600 });
  }
}

export async function loadConfig(): Promise<ChenaiCliConfig> {
  await ensureConfigFile();
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ChenaiCliConfig>;
    return mergeConfig(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      const backupPath = `${CONFIG_PATH}.bak`;
      await fs.copyFile(CONFIG_PATH, backupPath);
      await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), { encoding: 'utf-8', mode: 0o600 });
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

export async function saveConfig(config: ChenaiCliConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export async function updateConfig(partial: Partial<ChenaiCliConfig>): Promise<ChenaiCliConfig> {
  const current = await loadConfig();
  const next: ChenaiCliConfig = {
    ...current,
    ...partial,
    accounts: { ...current.accounts, ...(partial.accounts ?? {}) },
  };
  
  // Prevent prototype pollution
  if (next.accounts && (next.accounts as any).__proto__) {
    delete (next.accounts as any).__proto__;
  }
  if (next.accounts && (next.accounts as any).constructor) {
    delete (next.accounts as any).constructor;
  }
  if (next.accounts && (next.accounts as any).prototype) {
    delete (next.accounts as any).prototype;
  }

  await saveConfig(next);
  return next;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getAccountProfile(address: string, config: ChenaiCliConfig): AccountProfile | undefined {
  if (address === '__proto__' || address === 'constructor' || address === 'prototype') {
    return undefined;
  }
  return config.accounts[address];
}

export async function upsertAccountProfile(
  profile: AccountProfile,
  { setDefault }: { setDefault?: boolean } = {}
): Promise<ChenaiCliConfig> {
  // Validate public key to prevent prototype pollution or path traversal if used in paths
  if (!profile.publicKey || profile.publicKey === '__proto__' || profile.publicKey === 'constructor' || profile.publicKey === 'prototype') {
    throw new Error('Invalid account public key');
  }

  const config = await loadConfig();
  const next: ChenaiCliConfig = {
    ...config,
    accounts: {
      ...config.accounts,
      [profile.publicKey]: profile,
    },
    defaultAccount: setDefault ? profile.publicKey : config.defaultAccount,
  };
  await saveConfig(next);
  return next;
}

export function isSupportedNetwork(value: string | undefined): value is SupportedNetwork {
  return value === 'testnet' || value === 'mainnet';
}

export function resolveNetwork(
  candidate: string | undefined,
  fallback: SupportedNetwork
): SupportedNetwork {
  return isSupportedNetwork(candidate) ? candidate : fallback;
}
