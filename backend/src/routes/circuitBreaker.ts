import { Router, Request, Response } from 'express';
import { CircuitBreakerService } from '../services/circuitBreakerService';

export function createCircuitBreakerRouter(circuitBreaker: CircuitBreakerService): Router {
  const router = Router();

  // Get current circuit breaker state
  router.get('/state', (req: Request, res: Response) => {
    try {
      const state = circuitBreaker.getState();
      res.json({
        success: true,
        data: state,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'STATE_FETCH_ERROR',
          message: 'Failed to fetch circuit breaker state',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // Get circuit breaker metrics
  router.get('/metrics', (req: Request, res: Response) => {
    try {
      const metrics = circuitBreaker.getMetrics();
      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_FETCH_ERROR',
          message: 'Failed to fetch circuit breaker metrics',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // Get circuit breaker configuration
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = circuitBreaker.getConfig();
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_FETCH_ERROR',
          message: 'Failed to fetch circuit breaker configuration',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // Update circuit breaker configuration
  router.put('/config', (req: Request, res: Response) => {
    try {
      const configUpdates = req.body;
      circuitBreaker.updateConfig(configUpdates);
      const updatedConfig = circuitBreaker.getConfig();
      
      res.json({
        success: true,
        data: updatedConfig,
        message: 'Circuit breaker configuration updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_UPDATE_ERROR',
          message: 'Failed to update circuit breaker configuration',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // Reset circuit breaker
  router.post('/reset', (req: Request, res: Response) => {
    try {
      circuitBreaker.reset();
      const state = circuitBreaker.getState();
      
      res.json({
        success: true,
        data: state,
        message: 'Circuit breaker reset successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'RESET_ERROR',
          message: 'Failed to reset circuit breaker',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // Get trigger history
  router.get('/history', (req: Request, res: Response) => {
    try {
      const state = circuitBreaker.getState();
      const limit = parseInt(req.query.limit as string) || 50;
      const history = state.triggerHistory.slice(-limit);
      
      res.json({
        success: true,
        data: {
          total: state.triggerHistory.length,
          history,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_FETCH_ERROR',
          message: 'Failed to fetch trigger history',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // Evaluate a transaction (for testing)
  router.post('/evaluate', async (req: Request, res: Response) => {
    try {
      const transaction = req.body;
      const decision = await circuitBreaker.evaluateTransaction(transaction);
      
      res.json({
        success: true,
        data: decision,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'EVALUATION_ERROR',
          message: 'Failed to evaluate transaction',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  return router;
}
