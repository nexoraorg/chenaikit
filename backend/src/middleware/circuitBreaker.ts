import { Request, Response, NextFunction } from 'express';
import { CircuitBreakerService, Transaction } from '../services/circuitBreakerService';

export function createCircuitBreakerMiddleware(circuitBreaker: CircuitBreakerService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply circuit breaker to transaction-related endpoints
    if (!req.path.includes('/transaction') && !req.path.includes('/fraud')) {
      return next();
    }

    try {
      // Extract transaction data from request body
      const transactionData = extractTransactionData(req);
      
      if (!transactionData) {
        return next();
      }

      const decision = await circuitBreaker.evaluateTransaction(transactionData);

      // Add circuit breaker info to response headers
      res.setHeader('X-Circuit-Breaker-State', decision.state);
      res.setHeader('X-Circuit-Breaker-Risk-Score', decision.riskScore.toString());

      if (!decision.allowed) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'CIRCUIT_BREAKER_OPEN',
            message: 'Request blocked by circuit breaker due to high fraud risk',
            circuitBreakerState: decision.state,
            reason: decision.reason,
            riskScore: decision.riskScore,
            explainableFactors: decision.explainableFactors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Add decision info to request for downstream use
      (req as any).circuitBreakerDecision = decision;
      next();
    } catch (error) {
      // If circuit breaker fails, allow request to proceed (fail-open)
      // Log error but don't block requests on circuit breaker failures
      next();
    }
  };
}

function extractTransactionData(req: Request): Transaction | null {
  const body = req.body;
  
  // Check if request body contains transaction-like data
  if (!body || typeof body !== 'object') {
    return null;
  }

  // Try to extract transaction fields from various possible structures
  const transaction: Transaction = {
    id: body.id || body.transactionId || body.tx_id || generateTransactionId(),
    accountId: body.accountId || body.account_id || body.fromAccount || '',
    amount: body.amount || body.value || 0,
    currency: body.currency,
    timestamp: body.timestamp || body.created_at || Date.now(),
    merchantId: body.merchantId || body.merchant_id,
    merchantCategory: body.merchantCategory || body.merchant_category,
    country: body.country,
    city: body.city,
    lat: body.lat || body.latitude,
    lon: body.lon || body.longitude,
    deviceId: body.deviceId || body.device_id,
    channel: body.channel,
    ipAddress: body.ipAddress || body.ip_address,
    previousBalance: body.previousBalance || body.previous_balance,
  };

  // Validate required fields
  if (!transaction.accountId || transaction.amount === undefined) {
    return null;
  }

  return transaction;
}

function generateTransactionId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
