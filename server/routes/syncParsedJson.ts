/**
 * API routes for syncing parsed JSON data
 */
import express, { Request, Response } from 'express';
import { db } from '../db';
import { analysisResults } from '../../shared/schema';
import { eq, isNotNull, isNull, and } from 'drizzle-orm';
import { extractParsedJson } from '../services/syncParsedJsonService';

const router = express.Router();

/**
 * POST /api/sync-parsed-json
 * Syncs parsed JSON data for all analysis results (with limits)
 */
router.post('/sync-parsed-json', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.body;
    
    // Build the WHERE condition to find records that need processing
    const whereCondition = and(
      isNotNull(analysisResults.rawResponse),
      isNull(analysisResults.parsedJson)
    );
    
    // Get records that need processing with limit
    const results = await db
      .select()
      .from(analysisResults)
      .where(whereCondition)
      .limit(Number(limit));
    
    console.log(`Found ${results.length} analysis results that need parsedJson sync`);
    
    let processed = 0;
    let skipped = 0;
    
    // Process each result
    for (const result of results) {
      try {
        const rawResponse = result.rawResponse;
        
        // Extract the parsed JSON data
        const parsedJson = extractParsedJson(rawResponse);
        
        // Skip if no meaningful data was extracted
        if (!parsedJson || 
            (parsedJson.skills.length === 0 && 
             parsedJson.workHistory.length === 0 && 
             parsedJson.redFlags.length === 0 && 
             !parsedJson.summary)) {
          skipped++;
          continue;
        }
        
        // Update the database record with parsed data
        await db
          .update(analysisResults)
          .set({
            parsedJson,
            parsedSkills: parsedJson.skills.length > 0 ? parsedJson.skills : null,
            parsedWorkHistory: parsedJson.workHistory.length > 0 ? parsedJson.workHistory : null,
            parsedRedFlags: parsedJson.redFlags.length > 0 ? parsedJson.redFlags : null,
            parsedSummary: parsedJson.summary || null,
            parsingStatus: "complete",
            updatedAt: new Date()
          })
          .where(eq(analysisResults.id, result.id));
        
        processed++;
      } catch (error) {
        console.error(`Error processing record ${result.id}:`, error);
        skipped++;
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${processed} records, skipped ${skipped}`,
      processed,
      skipped,
      total: results.length
    });
  } catch (error) {
    console.error('Error syncing parsed JSON:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing parsed JSON data',
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/sync-parsed-json/:jobId
 * Syncs parsed JSON data for a specific job description
 */
router.post('/sync-parsed-json/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    // Get all records for this job that have rawResponse
    const results = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          eq(analysisResults.jobDescriptionId, jobId),
          isNotNull(analysisResults.rawResponse)
        )
      );
    
    console.log(`Found ${results.length} analysis results with raw_response for job ${jobId}`);
    
    let processed = 0;
    let skipped = 0;
    
    // Process each result
    for (const result of results) {
      try {
        const rawResponse = result.rawResponse;
        
        // Extract the parsed JSON data
        const parsedJson = extractParsedJson(rawResponse);
        
        // Skip if no meaningful data was extracted
        if (!parsedJson || 
            (parsedJson.skills.length === 0 && 
             parsedJson.workHistory.length === 0 && 
             parsedJson.redFlags.length === 0 && 
             !parsedJson.summary)) {
          skipped++;
          continue;
        }
        
        // Update the database record with parsed data
        await db
          .update(analysisResults)
          .set({
            parsedJson,
            parsedSkills: parsedJson.skills.length > 0 ? parsedJson.skills : null,
            parsedWorkHistory: parsedJson.workHistory.length > 0 ? parsedJson.workHistory : null,
            parsedRedFlags: parsedJson.redFlags.length > 0 ? parsedJson.redFlags : null,
            parsedSummary: parsedJson.summary || null,
            parsingStatus: "complete",
            updatedAt: new Date()
          })
          .where(eq(analysisResults.id, result.id));
        
        processed++;
      } catch (error) {
        console.error(`Error processing record ${result.id}:`, error);
        skipped++;
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${processed} records, skipped ${skipped} for job ${jobId}`,
      processed,
      skipped,
      total: results.length,
      jobId
    });
  } catch (error) {
    console.error(`Error syncing parsed JSON for job:`, error);
    res.status(500).json({
      success: false,
      message: 'Error syncing parsed JSON data for job',
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/sync-parsed-json/status
 * Get the status of parsedJson field population
 */
router.get('/sync-parsed-json/status', async (_req: Request, res: Response) => {
  try {
    // Count total records
    const totalResults = await db
      .select()
      .from(analysisResults)
      .then(rows => rows.length);
    
    // Count records with parsedJson
    const withParsedJson = await db
      .select()
      .from(analysisResults)
      .where(isNotNull(analysisResults.parsedJson))
      .then(rows => rows.length);
    
    // Count records with rawResponse but no parsedJson
    const needProcessing = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          isNotNull(analysisResults.rawResponse),
          isNull(analysisResults.parsedJson)
        )
      )
      .then(rows => rows.length);
    
    // Calculate percentages
    const total = totalResults;
    const processed = withParsedJson;
    const remaining = needProcessing;
    const percentComplete = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    res.json({
      success: true,
      status: {
        total,
        processed,
        remaining,
        percentComplete
      }
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting sync status',
      error: (error as Error).message
    });
  }
});

export default router;