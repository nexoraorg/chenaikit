type VaultKvVersion = 1 | 2;

type VaultClientOptions = {
  addr: string;
  token: string;
  kvMount: string;
  secretPath: string;
  kvVersion: VaultKvVersion;
};

const isEnvUnset = (value: string | undefined): boolean => {
  return value === undefined || value.trim().length === 0;
};

const getVaultOptions = (): VaultClientOptions | null => {
  const enabled = process.env.VAULT_ENABLED === 'true';
  if (!enabled) return null;

  const addr = process.env.VAULT_ADDR;
  const token = process.env.VAULT_TOKEN;
  const kvMount = process.env.VAULT_KV_MOUNT || 'secret';
  const secretPath = process.env.VAULT_SECRET_PATH || 'chenaikit/backend';
  const kvVersionRaw = process.env.VAULT_KV_VERSION || '2';

  if (!addr || !token) {
    throw new Error('VAULT_ADDR and VAULT_TOKEN are required when VAULT_ENABLED=true');
  }

  const kvVersion = (kvVersionRaw === '1' ? 1 : 2) as VaultKvVersion;

  return { addr, token, kvMount, secretPath, kvVersion };
};

const buildVaultReadUrl = (opts: VaultClientOptions): string => {
  const base = opts.addr.replace(/\/$/, '');

  if (opts.kvVersion === 1) {
    return `${base}/v1/${opts.kvMount}/${opts.secretPath}`;
  }

  return `${base}/v1/${opts.kvMount}/data/${opts.secretPath}`;
};

const extractSecretData = (kvVersion: VaultKvVersion, json: any): Record<string, string> => {
  if (kvVersion === 1) {
    return (json?.data || {}) as Record<string, string>;
  }

  return (json?.data?.data || {}) as Record<string, string>;
};

export const loadVaultSecrets = async (): Promise<void> => {
  const opts = getVaultOptions();
  if (!opts) return;

  const url = buildVaultReadUrl(opts);
  const timeoutMs = Number(process.env.VAULT_TIMEOUT_MS || '5000');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Vault-Token': opts.token,
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Vault secret read failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as any;
  const secrets = extractSecretData(opts.kvVersion, json);

  for (const [key, value] of Object.entries(secrets)) {
    if (typeof value === 'string' && isEnvUnset(process.env[key])) {
      process.env[key] = value;
    }
  }
};
