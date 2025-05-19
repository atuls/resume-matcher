/**
 * Enhanced endpoint to sync parsedJson from rawResponse with improved field variation handling
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { analysisResults } from '../../shared/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { extractRawResponseContent, updateParsedJson, processRawResponseBatch } from '../services/enhancedResponseParserService';

const router = Router();

/**
 * POST /api/enhanced-sync-parsed-json
 * Process a batch of records to extract parsedJson with improved field variation handling
 */
router.post('/enhanced-sync-parsed-json', async (req: Request, res: Response) => {
  try {
    const { batchSize = 100 } = req.body;
    
    const result = await processRawResponseBatch(Number(batchSize));
    
    res.json({
      success: true,
      message: `Processed ${result.processed} records, successfully updated ${result.successful}`,
      processedCount: result.processed,
      successCount: result.successful
    });
  } catch (error) {
    console.error('Error syncing parsed JSON with enhanced parser:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing parsed JSON with enhanced parser',
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/enhanced-sync-parsed-json/:id
 * Process a specific record to extract parsedJson with improved field variation handling
 */
router.post('/enhanced-sync-parsed-json/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get the record
    const record = await db
      .select({
        id: analysisResults.id,
        rawResponse: analysisResults.rawResponse
      })
      .from(analysisResults)
      .where(eq(analysisResults.id, id))
      .limit(1);
    
    if (record.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Record with ID ${id} not found`
      });
    }
    
    // Process the record
    const success = await updateParsedJson(id, record[0].rawResponse);
    
    if (success) {
      res.json({
        success: true,
        message: `Successfully updated parsedJson for record ${id}`
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Failed to extract parsedJson for record ${id}`
      });
    }
  } catch (error) {
    console.error(`Error syncing parsed JSON for record ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error syncing parsed JSON',
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/enhanced-sync-parsed-json/job/:jobId
 * Process all records for a specific job to extract parsedJson with improved field variation handling
 */
router.post('/enhanced-sync-parsed-json/job/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { limit = 100 } = req.body;
    
    // Get records for this job that don't have parsedJson
    const records = await db
      .select({
        id: analysisResults.id,
        rawResponse: analysisResults.rawResponse
      })
      .from(analysisResults)
      .where(and(
        eq(analysisResults.jobDescriptionId, jobId),
        isNull(analysisResults.parsedJson)
      ))
      .limit(Number(limit));
    
    console.log(`Found ${records.length} records without parsedJson for job ${jobId}`);
    
    let processed = 0;
    let successful = 0;
    
    // Process each record
    for (const record of records) {
      processed++;
      const success = await updateParsedJson(record.id, record.rawResponse);
      if (success) {
        successful++;
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${processed} records, successfully updated ${successful} for job ${jobId}`,
      processedCount: processed,
      successCount: successful
    });
  } catch (error) {
    console.error(`Error syncing parsed JSON for job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error syncing parsed JSON',
      error: (error as Error).message
    });
  }
});

export default router;