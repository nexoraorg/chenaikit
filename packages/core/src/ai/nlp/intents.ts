import {
  BlockchainOperationRequest,
  EntityType,
  IntentClassification,
  NLPEntity,
  WalletIntent,
} from './types';

const ADDRESS_REGEX = /\bG[A-Z0-9]{20,56}\b/g;
const AMOUNT_REGEX = /\b\d+(?:\.\d{1,7})?\b/g;
const SUPPORTED_ASSETS = ['XLM', 'USDC', 'BTC', 'ETH', 'EURC'] as const;

const INTENT_KEYWORDS: Record<WalletIntent, string[]> = {
  check_balance: ['balance', 'funds', 'how much', 'wallet value', 'holdings'],
  send_payment: ['send', 'pay', 'transfer', 'remit', 'move funds'],
  show_transactions: ['transactions', 'history', 'activity', 'recent payments'],
  swap_asset: ['swap', 'trade', 'exchange', 'convert'],
  request_help: ['help', 'what can you do', 'commands', 'support'],
  unknown: [],
};

const REQUIRED_ENTITIES: Partial<Record<WalletIntent, EntityType[]>> = {
  send_payment: ['amount', 'address'],
  swap_asset: ['amount', 'asset'],
};

export const PROMPT_TEMPLATES: Record<
  Exclude<WalletIntent, 'unknown'>,
  string
> = {
  check_balance: 'Check the current on-chain wallet balance.',
  send_payment: 'Send a blockchain payment after validating amount and address.',
  show_transactions: 'Fetch recent wallet transactions from the blockchain.',
  swap_asset: 'Swap one asset for another using a supported route.',
  request_help: 'Provide safe and concise wallet assistant instructions.',
};

export function extractEntities(input: string): NLPEntity[] {
  const entities: NLPEntity[] = [];

  const amounts = input.match(AMOUNT_REGEX) || [];
  for (const amount of amounts) {
    entities.push({ type: 'amount', value: amount, confidence: 0.8 });
  }

  const addresses = input.match(ADDRESS_REGEX) || [];
  for (const address of addresses) {
    entities.push({ type: 'address', value: address, confidence: 0.95 });
  }

  const upperInput = input.toUpperCase();
  for (const asset of SUPPORTED_ASSETS) {
    if (upperInput.includes(asset)) {
      entities.push({ type: 'asset', value: asset, confidence: 0.9 });
    }
  }

  if (/\b(today|yesterday|week|month|recent)\b/i.test(input)) {
    entities.push({ type: 'timeframe', value: 'recent', confidence: 0.7 });
  }

  return dedupeEntities(entities);
}

export function classifyIntentRuleBased(input: string): IntentClassification {
  const lower = input.toLowerCase();
  const entities = extractEntities(input);

  let bestIntent: WalletIntent = 'unknown';
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as Array<
    [WalletIntent, string[]]
  >) {
    if (intent === 'unknown') continue;
    const score = keywords.reduce((count, keyword) => {
      return count + (lower.includes(keyword) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const confidence = bestIntent === 'unknown' ? 0.3 : Math.min(0.95, 0.5 + bestScore * 0.2);
  const missingEntities = inferMissingEntities(bestIntent, entities);

  return {
    intent: bestIntent,
    confidence,
    entities,
    missingEntities,
    requiresConfirmation: bestIntent === 'send_payment' || bestIntent === 'swap_asset',
  };
}

export function inferMissingEntities(
  intent: WalletIntent,
  entities: NLPEntity[]
): EntityType[] {
  const required = REQUIRED_ENTITIES[intent] || [];
  const present = new Set(entities.map((entity) => entity.type));

  return required.filter((entityType) => !present.has(entityType));
}

export function buildBlockchainOperation(
  classification: IntentClassification
): BlockchainOperationRequest | undefined {
  const getEntity = (type: EntityType): string | undefined =>
    classification.entities.find((entity) => entity.type === type)?.value;

  switch (classification.intent) {
    case 'check_balance':
      return {
        type: 'get_balance',
        params: {},
        safetyChecks: ['Verify wallet session exists'],
      };
    case 'send_payment':
      return {
        type: 'send_payment',
        params: {
          amount: Number(getEntity('amount') || 0),
          destination: getEntity('address') || '',
          asset: getEntity('asset') || 'XLM',
        },
        safetyChecks: [
          'Validate destination address format',
          'Require user confirmation before broadcast',
          'Ensure sufficient balance',
        ],
      };
    case 'show_transactions':
      return {
        type: 'get_transactions',
        params: {
          timeframe: getEntity('timeframe') || 'recent',
        },
        safetyChecks: ['Restrict to the authenticated wallet account'],
      };
    case 'swap_asset':
      return {
        type: 'swap_asset',
        params: {
          amount: Number(getEntity('amount') || 0),
          asset: getEntity('asset') || 'XLM',
        },
        safetyChecks: [
          'Require user confirmation before swap',
          'Validate supported asset pair',
          'Check slippage limits',
        ],
      };
    case 'request_help':
      return {
        type: 'help',
        params: {},
        safetyChecks: [],
      };
    default:
      return undefined;
  }
}

export function followUpQuestion(intent: WalletIntent, missing: EntityType[]): string {
  if (intent === 'send_payment' && missing.includes('amount') && missing.includes('address')) {
    return 'I can help with that payment. What amount should I send and to which wallet address?';
  }
  if (intent === 'send_payment' && missing.includes('address')) {
    return 'Please share the destination wallet address before I prepare the transaction.';
  }
  if (intent === 'send_payment' && missing.includes('amount')) {
    return 'How much would you like to send?';
  }
  if (intent === 'swap_asset' && missing.includes('amount')) {
    return 'What amount should I swap?';
  }
  if (intent === 'swap_asset' && missing.includes('asset')) {
    return 'Which asset should I swap to? (for example XLM or USDC)';
  }
  return 'Can you share a bit more detail so I can help?';
}

export function mergeEntities(base: NLPEntity[], incoming: NLPEntity[]): NLPEntity[] {
  return dedupeEntities([...base, ...incoming]);
}

function dedupeEntities(entities: NLPEntity[]): NLPEntity[] {
  const keyToEntity = new Map<string, NLPEntity>();
  for (const entity of entities) {
    const key = `${entity.type}:${entity.value.toUpperCase()}`;
    const existing = keyToEntity.get(key);
    if (!existing || existing.confidence < entity.confidence) {
      keyToEntity.set(key, entity);
    }
  }
  return Array.from(keyToEntity.values());
}

