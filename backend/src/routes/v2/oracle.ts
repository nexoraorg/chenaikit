import { Router, Request, Response } from 'express';
import { oracleService } from '../../services/oracleService';
import { requireAuth } from '../../middleware/auth';

const router = Router();

/**
 * GET /v2/oracle/nodes
 * Get all active oracle nodes
 */
router.get('/nodes', async (req: Request, res: Response) => {
  try {
    const nodes = await oracleService.getActiveNodes();
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /v2/oracle/nodes/:address
 * Get a specific oracle node by address
 */
router.get('/nodes/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const node = await oracleService.getNodeByAddress(address);
    
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }
    
    res.json({ success: true, data: node });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /v2/oracle/nodes
 * Register a new oracle node (admin only)
 */
router.post('/nodes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { address, publicKey, stake, metadata } = req.body;
    
    // TODO: Add admin role check
    const node = await oracleService.registerNode({
      address,
      publicKey,
      stake: BigInt(stake),
      metadata,
    });
    
    res.status(201).json({ success: true, data: node });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /v2/oracle/nodes/:id
 * Unregister an oracle node (admin only)
 */
router.delete('/nodes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // TODO: Add admin role check
    const node = await oracleService.unregisterNode(id);
    
    res.json({ success: true, data: node });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /v2/oracle/submissions/:requestId
 * Get all submissions for a specific request
 */
router.get('/submissions/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const submissions = await oracleService.getSubmissionsByRequest(requestId);
    res.json({ success: true, data: submissions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /v2/oracle/submissions/commit
 * Record a commit submission (called by oracle nodes)
 */
router.post('/submissions/commit', async (req: Request, res: Response) => {
  try {
    const { requestId, nodeId, modelHash, commitHash } = req.body;
    
    const submission = await oracleService.recordCommit({
      requestId,
      nodeId,
      modelHash,
      commitHash,
    });
    
    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /v2/oracle/submissions/reveal
 * Record a reveal submission (called by oracle nodes)
 */
router.post('/submissions/reveal', async (req: Request, res: Response) => {
  try {
    const { requestId, nodeId, score, salt } = req.body;
    
    const submission = await oracleService.recordReveal({
      requestId,
      nodeId,
      score,
      salt,
    });
    
    res.json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /v2/oracle/submissions/:requestId/finalize
 * Finalize submissions for a request
 */
router.post('/submissions/:requestId/finalize', requireAuth, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    
    // TODO: Add admin role check
    await oracleService.finalizeSubmission(requestId);
    
    res.json({ success: true, message: 'Submissions finalized' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /v2/oracle/disputes/:requestId
 * Get disputes for a specific request
 */
router.get('/disputes/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const disputes = await oracleService.getDisputesByRequest(requestId);
    res.json({ success: true, data: disputes });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /v2/oracle/disputes
 * File a new dispute
 */
router.post('/disputes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { requestId, disputerAddress, evidence } = req.body;
    
    const dispute = await oracleService.fileDispute({
      requestId,
      disputerAddress,
      evidence,
    });
    
    res.status(201).json({ success: true, data: dispute });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PUT /v2/oracle/disputes/:id/resolve
 * Resolve a dispute (admin only)
 */
router.put('/disputes/:id/resolve', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, resolvedBy, resolutionNotes } = req.body;
    
    // TODO: Add admin role check
    const dispute = await oracleService.resolveDispute(id, {
      status,
      resolvedBy,
      resolutionNotes,
    });
    
    res.json({ success: true, data: dispute });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /v2/oracle/slashes/:nodeId
 * Get slash events for a specific node
 */
router.get('/slashes/:nodeId', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const slashEvents = await oracleService.getSlashEventsByNode(nodeId);
    res.json({ success: true, data: slashEvents });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /v2/oracle/slashes
 * Record a slash event (called by oracle contract)
 */
router.post('/slashes', async (req: Request, res: Response) => {
  try {
    const { nodeId, requestId, slashAmount, reason, treasuryShare, disputerShare, disputerReward } = req.body;
    
    const slashEvent = await oracleService.recordSlashEvent({
      nodeId,
      requestId,
      slashAmount: BigInt(slashAmount),
      reason,
      treasuryShare: BigInt(treasuryShare),
      disputerShare,
      disputerReward: disputerReward ? BigInt(disputerReward) : undefined,
    });
    
    res.status(201).json({ success: true, data: slashEvent });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /v2/oracle/reputation/:nodeId
 * Get reputation history for a node
 */
router.get('/reputation/:nodeId', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const history = await oracleService.getReputationHistory(nodeId, limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PUT /v2/oracle/nodes/:id/reputation
 * Update node reputation (admin only)
 */
router.put('/nodes/:id/reputation', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { delta, reason } = req.body;
    
    // TODO: Add admin role check
    const node = await oracleService.updateNodeReputation(id, delta, reason);
    
    res.json({ success: true, data: node });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /v2/oracle/stats
 * Get oracle network statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await oracleService.getNetworkStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /v2/oracle/activity
 * Get recent oracle network activity
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const activity = await oracleService.getRecentActivity(limit);
    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
