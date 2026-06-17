import { Request, Response } from 'express';
import {
  Account,
  Transaction,
  AccountCreationRequest,
  PaginationQuery,
  PaginatedResponse,
  AccountResponse,
  AccountBalanceResponse,
  TransactionsResponse,
  AccountCreationResponse
} from '../types/api';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';

// Mock data storage (in a real app, this would be a database)
const accounts: Map<string, Account> = new Map();
const transactions: Map<string, Transaction[]> = new Map();

// Initialize with some mock data
const mockAccount: Account = {
  id: 'GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK',
  name: 'John Doe',
  email: 'john.doe@example.com',
  publicKey: 'GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK',
  balance: 1000.50,
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date().toISOString(),
  isActive: true
};

const mockTransactions: Transaction[] = [
  {
    id: 'tx_001',
    accountId: mockAccount.id,
    amount: 500.00,
    type: 'credit',
    description: 'Initial deposit',
    timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
    status: 'completed'
  },
  {
    id: 'tx_002',
    accountId: mockAccount.id,
    amount: -50.25,
    type: 'debit',
    description: 'Payment to merchant',
    timestamp: new Date('2024-01-02T14:30:00Z').toISOString(),
    toAccount: 'GOTHER123456789',
    status: 'completed'
  },
  {
    id: 'tx_003',
    accountId: mockAccount.id,
    amount: 550.75,
    type: 'credit',
    description: 'Received payment',
    timestamp: new Date('2024-01-03T09:15:00Z').toISOString(),
    fromAccount: 'GSENDER123456789',
    status: 'completed'
  }
];

accounts.set(mockAccount.id, mockAccount);
transactions.set(mockAccount.id, mockTransactions);

export class AccountController {
  static async getAccount(req: Request, res: Response) {
    const { id } = req.params;

    const account = accounts.get(id);
    if (!account) {
      throw new NotFoundError('Account not found', { accountId: id });
    }

    if (!account.isActive) {
      throw new ValidationError('Account is inactive', { accountId: id });
    }

    const response: AccountResponse = {
      success: true,
      data: account,
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);
  }

  static async getAccountBalance(req: Request, res: Response) {
    const { id } = req.params;

    const account = accounts.get(id);
    if (!account) {
      throw new NotFoundError('Account not found', { accountId: id });
    }

    if (!account.isActive) {
      throw new ValidationError('Account is inactive', { accountId: id });
    }

    const response: AccountBalanceResponse = {
      success: true,
      data: {
        balance: account.balance,
        accountId: account.id
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);
  }

  static async getAccountTransactions(req: Request, res: Response) {
    const { id } = req.params;
    const query = req.query as PaginationQuery;

    const account = accounts.get(id);
    if (!account) {
      throw new NotFoundError('Account not found', { accountId: id });
    }

    const accountTransactions = transactions.get(id) || [];

    // Pagination parameters
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder || 'desc';

    // Sort transactions
    const sortedTransactions = [...accountTransactions].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'timestamp') {
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortBy === 'amount') {
        comparison = Math.abs(a.amount) - Math.abs(b.amount);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Calculate pagination
    const total = sortedTransactions.length;
    const pages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

    const paginatedResponse: PaginatedResponse<Transaction> = {
      data: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      }
    };

    const response: TransactionsResponse = {
      success: true,
      data: paginatedResponse,
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);
  }

  static async createAccount(req: Request, res: Response) {
    const { name, email, publicKey }: AccountCreationRequest = req.body;

    // Check if account already exists
    if (accounts.has(publicKey)) {
      throw new ConflictError('Account with this public key already exists', { publicKey });
    }

    // Check if email already exists
    for (const account of accounts.values()) {
      if (account.email === email) {
        throw new ConflictError('Account with this email already exists', { email });
      }
    }

    const newAccount: Account = {
      id: publicKey,
      name,
      email,
      publicKey,
      balance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    accounts.set(publicKey, newAccount);
    transactions.set(publicKey, []);

    const response: AccountCreationResponse = {
      success: true,
      data: newAccount,
      timestamp: new Date().toISOString()
    };

    res.status(201).json(response);
  }
}