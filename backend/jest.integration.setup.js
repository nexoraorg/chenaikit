// Jest setup for integration tests
process.env.NODE_ENV = 'test';

// Mock external services
jest.mock('@stellar/stellar-sdk', () => ({
  Server: jest.fn(),
  Horizon: jest.fn(),
  TransactionBuilder: jest.fn(),
  Keypair: jest.fn(),
  Asset: jest.fn(),
  Operation: jest.fn(),
}));

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock database
jest.mock('../generated/prisma', () => ({
  PrismaClient: jest.fn(() => ({
    apiKey: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    apiUsage: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));

// Set test timeout
jest.setTimeout(30000);
