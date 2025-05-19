import { Router } from 'express';

const router = Router();

/**
 * Route to sync parsed JSON data for all records
 * POST /api/sync-parsed-json
 */
router.post('/sync-parsed-json', async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    
    // Import sync function on demand
    const { syncAllParsedJson } = await import('../services/syncParsedJsonService');
    
    console.log(`Starting to sync parsedJson for up to ${limit} records`);
    
    const result = await syncAllParsedJson(parseInt(limit, 10));
    
    res.json({
      success: true,
      message: `Processing complete. ${result.processed} records processed, ${result.skipped} skipped out of ${result.total} total.`,
      result
    });
  } catch (error) {
    console.error('Error in sync-parsed-json endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Route to sync parsed JSON for a specific job
 * POST /api/sync-parsed-json/:jobId
 */
router.post('/sync-parsed-json/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Import sync function on demand
    const { syncParsedJsonForJob } = await import('../services/syncParsedJsonService');
    
    console.log(`Starting to sync parsedJson for job ID: ${jobId}`);
    
    const result = await syncParsedJsonForJob(jobId);
    
    res.json({
      success: true,
      message: `Processing complete. ${result.processed} records processed, ${result.skipped} skipped out of ${result.total} total.`,
      result
    });
  } catch (error) {
    console.error('Error in sync-parsed-json-job endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;