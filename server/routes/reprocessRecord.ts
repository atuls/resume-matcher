import { Router } from 'express';
import { processAnalysisResult, resetAndReprocessAnalysisResult } from '../processProblemRecords';

const router = Router();

/**
 * Route to reprocess a single analysis result
 * POST /api/reprocess/:analysisId
 */
router.post('/reprocess/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { reset = true } = req.body;
    
    console.log(`Reprocessing analysis ID: ${analysisId} (reset=${reset})`);
    
    // Use the reset function if requested, otherwise just process
    const success = reset
      ? await resetAndReprocessAnalysisResult(analysisId)
      : await processAnalysisResult(analysisId);
    
    if (success) {
      res.json({ success: true, message: 'Analysis result processed successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Failed to process analysis result' });
    }
  } catch (error) {
    console.error('Error in reprocess endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Route to reprocess multiple analysis results by job ID
 * POST /api/reprocess-job/:jobId
 */
router.post('/reprocess-job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 10, reset = true } = req.body;
    
    console.log(`Reprocessing analysis results for job ID: ${jobId} (limit=${limit}, reset=${reset})`);
    
    // Import function on demand
    const { processAnalysisResultsByJob } = await import('../processProblemRecords');
    
    const result = await processAnalysisResultsByJob(jobId, limit, reset);
    
    res.json({
      success: true,
      message: `Processing complete. ${result.success} successful, ${result.failed} failed out of ${result.total} total.`,
      result
    });
  } catch (error) {
    console.error('Error in reprocess-job endpoint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;