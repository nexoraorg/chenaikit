// Core exports
export * from './stellar';
export * from './ai';
export * from './blockchain';
export * from './utils';
export * from './types';

// Main classes
export { StellarConnector } from './stellar/connector';
export { AIService } from './ai/service';
export { CreditScorer } from './ai/credit-scorer';
export { FraudDetector } from './ai/fraud-detector';

// Blockchain monitoring classes
export { TransactionMonitor } from './blockchain/monitoring/transactionMonitor';
export { AlertSystem } from './blockchain/monitoring/alertSystem';
export { TransactionAnalytics } from './blockchain/monitoring/analytics';
export { MonitoringDashboard } from './blockchain/monitoring/dashboard';

// Form validation utilities
export { ValidationRules, validateField, validateFields } from './utils/validation';
export * from './types/form';

// Monitoring types
export type { MonitoringConfig, TransactionEvent, Alert } from './blockchain/monitoring/types';
